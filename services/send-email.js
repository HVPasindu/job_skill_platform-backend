const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const sendOtpEmail = async (toEmail, otp) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: toEmail,
        subject: "Email Verification OTP",
        html: `
            <h2>Job Skill Platform</h2>
            <p>Your OTP code is:</p>
            <h1>${otp}</h1>
            <p>This OTP will expire in 10 minutes.</p>
        `,
    };

    return transporter.sendMail(mailOptions);
};

const sendCompanyAddedEmail = async (toEmail, companyName, companyRole) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: toEmail,
        subject: "You have been added to a company",
        html: `
            <h2>Job Skill Platform</h2>
            <p>You have been added to <b>${companyName}</b>.</p>
            <p>Your role: <b>${companyRole}</b></p>
            <p>You can now login and access company-related features.</p>
        `,
    };

    return transporter.sendMail(mailOptions);
};

module.exports = {
    sendOtpEmail,
    sendCompanyAddedEmail
};