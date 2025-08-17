// server.js
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { Groq } = require('groq-sdk');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const allowedOrigins = [
  'http://localhost:3000', // local frontend
  'https://ai-summariser-ieaq.vercel.app' // deployed frontend (no trailing slash)
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true); // allow Postman / curl
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error(`CORS not allowed for origin: ${origin}`), false);
    }
  },
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true
}));
app.use(express.json());

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/plain' || file.originalname.endsWith('.txt') || file.originalname.endsWith('.md')) {
            cb(null, true);
        } else {
            cb(new Error('Only text files are allowed'), false);
        }
    },
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Initialize Groq client
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

// Initialize email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Routes
app.get('/api/health', (req, res) => {
    res.json({ status: 'Server is running' });
});

app.post('/api/upload', upload.single('transcript'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const content = req.file.buffer.toString('utf-8');
        res.json({
            success: true,
            filename: req.file.originalname,
            content: content,
            preview: content.substring(0, 500) + (content.length > 500 ? '...' : '')
        });
    } catch (error) {
        res.status(500).json({ error: 'Error processing file: ' + error.message });
    }
});

app.post('/api/generate-summary', async (req, res) => {
    try {
        const { content, prompt } = req.body;
        if (!content || !prompt) {
            return res.status(400).json({ error: 'Content and prompt are required' });
        }

        const systemPrompt = `You are an AI assistant specialized in summarizing meeting notes and transcripts. 
        Please follow the user's specific instructions carefully and provide a well-structured, professional summary.`;

        const userPrompt = `Here is a meeting transcript/notes:

${content}

Please process this according to the following instructions: ${prompt}

Make sure your response is well-formatted and professional.`;

        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            model: "llama-3.1-8b-instant",
            temperature: 0.3,
            max_tokens: 2000,
            top_p: 1,
            stream: false
        });

        const summary = completion.choices[0]?.message?.content;
        if (!summary) throw new Error('No summary generated');

        res.json({ success: true, summary });
    } catch (error) {
        console.error('Groq API Error:', error);
        res.status(500).json({ error: 'Error generating summary: ' + error.message });
    }
});

app.post('/api/send-email', async (req, res) => {
    try {
        const { recipients, summary, subject = 'Meeting Summary' } = req.body;
        if (!recipients || !summary) {
            return res.status(400).json({ error: 'Recipients and summary are required' });
        }

        const recipientList = recipients.split(',').map(email => email.trim());
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const invalidEmails = recipientList.filter(email => !emailRegex.test(email));
        
        if (invalidEmails.length > 0) {
            return res.status(400).json({ error: `Invalid email addresses: ${invalidEmails.join(', ')}` });
        }

        const htmlContent = `
            <html>
            <body>
                <h2>🤖 AI Meeting Summary</h2>
                <div>${summary.replace(/\n/g, '<br>')}</div>
            </body>
            </html>
        `;

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: recipientList,
            subject,
            text: summary,
            html: htmlContent
        });

        res.json({
            success: true,
            message: `Summary sent successfully to ${recipientList.length} recipient(s)`,
            recipients: recipientList
        });
    } catch (error) {
        console.error('Email Error:', error);
        res.status(500).json({ error: 'Error sending email: ' + error.message });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
    }
    res.status(500).json({ error: error.message });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});

module.exports = app;
