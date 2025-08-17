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
app.use(cors());
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
    service: 'gmail', // or your preferred email service
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Routes

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'Server is running' });
});

// Upload and process text file
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

// Generate summary using Groq AI
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
                {
                    role: "system",
                    content: systemPrompt
                },
                {
                    role: "user",
                    content: userPrompt
                }
            ],
            model: "llama-3.1-8b-instant", // or "mixtral-8x7b-32768"
            temperature: 0.3,
            max_tokens: 2000,
            top_p: 1,
            stream: false
        });

        const summary = completion.choices[0]?.message?.content;

        if (!summary) {
            throw new Error('No summary generated');
        }

        res.json({
            success: true,
            summary: summary
        });

    } catch (error) {
        console.error('Groq API Error:', error);
        res.status(500).json({ 
            error: 'Error generating summary: ' + error.message 
        });
    }
});

// Send email with summary
app.post('/api/send-email', async (req, res) => {
    try {
        const { recipients, summary, subject = 'Meeting Summary' } = req.body;

        if (!recipients || !summary) {
            return res.status(400).json({ error: 'Recipients and summary are required' });
        }

        // Parse recipients (comma-separated)
        const recipientList = recipients.split(',').map(email => email.trim());

        // Validate email addresses
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const invalidEmails = recipientList.filter(email => !emailRegex.test(email));
        
        if (invalidEmails.length > 0) {
            return res.status(400).json({ 
                error: `Invalid email addresses: ${invalidEmails.join(', ')}` 
            });
        }

        // Prepare email content
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background: #f8f9fa; }
                    .summary { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .footer { text-align: center; padding: 20px; color: #666; font-size: 0.9em; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🤖 AI Meeting Summary</h1>
                    <p>Generated by AI Meeting Notes Summarizer</p>
                </div>
                <div class="content">
                    <div class="summary">
                        ${summary.replace(/\n/g, '<br>')}
                    </div>
                </div>
                <div class="footer">
                    <p>This summary was generated using AI technology. Please review for accuracy.</p>
                </div>
            </body>
            </html>
        `;

        const textContent = summary;

        // Send email to all recipients
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: recipientList,
            subject: subject,
            text: textContent,
            html: htmlContent
        };

        await transporter.sendMail(mailOptions);

        res.json({
            success: true,
            message: `Summary sent successfully to ${recipientList.length} recipient(s)`,
            recipients: recipientList
        });

    } catch (error) {
        console.error('Email Error:', error);
        res.status(500).json({ 
            error: 'Error sending email: ' + error.message 
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
        }
    }
    res.status(500).json({ error: error.message });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Frontend available at: http://localhost:${PORT}`);
});

module.exports = app;