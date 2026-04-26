// const db = require("../db/db-connection");
// const axios = require("axios");

// const askChatbot = async (req, res) => {
//     try {
//         const userId = req.user ? req.user.id : null;
//         const { question } = req.body;

//         if (!question) {
//             return res.status(400).json({
//                 success: false,
//                 message: "question is required"
//             });
//         }

//         const response = await axios.post(
//             "https://openrouter.ai/api/v1/chat/completions",
//             {
//                 model: process.env.OPENROUTER_MODEL || "openrouter/free",
//                 messages: [
//                     {
//                         role: "system",
//                         content: `
// You are a chatbot for Job & Skill Development Platform.

// Only answer questions related to this platform:
// - job seekers
// - employers
// - trainers
// - jobs
// - job applications
// - resumes/documents
// - courses
// - mentorship sessions
// - platform usage

// Do not answer unrelated questions like maths, politics, entertainment, or general knowledge.
// If unrelated, reply:
// "I can only help with Job & Skill Development Platform related questions."

// Platform facts:
// - Users can sign up as job seeker, employer, or trainer.
// - Job seekers can create a profile, add education, add experience, add skills, upload resumes/documents, search jobs, apply for jobs, enroll in courses, and join mentorship sessions.
// - Employers can create or manage companies, post jobs, add required job skills, and update job application status.
// - Trainers can create a trainer profile, create courses, add course materials, and create mentorship sessions.
// - Admins can manage users, jobs, categories, and analytics.
// - Resume/document upload supports PDF, DOC, DOCX, JPG, JPEG, and PNG.
// - Documents can have document_type: cv, certificate, or other.
// - Users can set one uploaded document as primary.
// - Resume parsing can extract text from PDF, DOCX, and image files.
// - Courses can contain materials such as YouTube links, external links, PDFs, documents, and images.
// - Job seekers can enroll in published courses.
// - Job seekers can join scheduled mentorship sessions.
// - Application statuses include pending, reviewed, shortlisted, rejected, accepted, and withdrawn.
// - If you do not know the exact screen name or button name, do not invent it. Explain generally.
// - Keep answers simple, clear, and helpful.
// `
//                     },
//                     {
//                         role: "user",
//                         content: question
//                     }
//                 ]
//             },
//             {
//                 headers: {
//                     Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
//                     "Content-Type": "application/json"
//                 }
//             }
//         );

//         const answer = response.data.choices[0].message.content;

//         const insertLogQuery = `
//             INSERT INTO chatbot_logs (
//                 user_id,
//                 question,
//                 response
//             )
//             VALUES (?, ?, ?)
//         `;

//         db.query(insertLogQuery, [userId, question, answer], (logError) => {
//             if (logError) {
//                 return res.status(500).json({
//                     success: false,
//                     message: "Chatbot log save failed",
//                     error: logError.message
//                 });
//             }

//             return res.status(200).json({
//                 success: true,
//                 question,
//                 answer
//             });
//         });
//     } catch (error) {
//         return res.status(500).json({
//             success: false,
//             message: "Chatbot request failed",
//             error: error.message
//         });
//     }
// };


// // const getChatbotLogs = (req, res) => {
// //     const query = `
// //         SELECT 
// //             cl.*,
// //             u.full_name,
// //             u.email
// //         FROM chatbot_logs cl
// //         LEFT JOIN users u ON cl.user_id = u.id
// //         ORDER BY cl.created_at DESC
// //     `;

// //     db.query(query, (err, result) => {
// //         if (err) {
// //             return res.status(500).json({
// //                 success: false,
// //                 message: "Fetch chatbot logs failed",
// //                 error: err.message
// //             });
// //         }

// //         return res.status(200).json({
// //             success: true,
// //             logs: result
// //         });
// //     });
// // };

// const getChatbotLogs = (req, res) => {
//     const page = Number(req.query.page) || 1;
//     const limit = Number(req.query.limit) || 20;
//     const offset = (page - 1) * limit;

//     const query = `
//         SELECT 
//             cl.*,
//             u.full_name,
//             u.email
//         FROM chatbot_logs cl
//         LEFT JOIN users u ON cl.user_id = u.id
//         ORDER BY cl.created_at DESC
//         LIMIT ? OFFSET ?
//     `;

//     db.query(query, [limit, offset], (err, result) => {
//         if (err) {
//             return res.status(500).json({
//                 success: false,
//                 message: "Fetch chatbot logs failed",
//                 error: err.message
//             });
//         }

//         return res.status(200).json({
//             success: true,
//             page,
//             limit,
//             logs: result
//         });
//     });
// };

// module.exports = {
//     askChatbot,
//     getChatbotLogs
// };




// const db = require("../db/db-connection");
// const axios = require("axios");

// // helper function
// const sendAndSaveChatbotLog = (userId, question, answer, res) => {
//     const insertLogQuery = `
//         INSERT INTO chatbot_logs (
//             user_id,
//             question,
//             response
//         )
//         VALUES (?, ?, ?)
//     `;

//     db.query(insertLogQuery, [userId, question, answer], (logError) => {
//         if (logError) {
//             return res.status(500).json({
//                 success: false,
//                 message: "Chatbot log save failed",
//                 error: logError.message
//             });
//         }

//         return res.status(200).json({
//             success: true,
//             question,
//             answer
//         });
//     });
// };

// const askChatbot = async (req, res) => {
//     try {
//         const userId = req.user ? req.user.id : null;
//         const { question } = req.body;

//         if (!question) {
//             return res.status(400).json({
//                 success: false,
//                 message: "question is required"
//             });
//         }

//         const questionLower = question.toLowerCase();

//         // ---------- JOB SEARCH ----------
//         if (questionLower.includes("job")) {

//             const query = `
//                 SELECT j.title, j.location, j.job_type, c.company_name
//                 FROM jobs j
//                 JOIN companies c ON j.company_id = c.id
//                 WHERE j.status = 'open'
//                 ORDER BY j.created_at DESC
//                 LIMIT 5
//             `;

//             db.query(query, (err, jobs) => {
//                 if (err) {
//                     return res.status(500).json({
//                         success: false,
//                         message: "Fetch jobs failed",
//                         error: err.message
//                     });
//                 }

//                 const answer = jobs.length === 0
//                     ? "No jobs found at the moment."
//                     : "Here are some jobs:\n\n" +
//                       jobs.map(j => `• ${j.title} at ${j.company_name} (${j.location})`).join("\n");

//                 sendAndSaveChatbotLog(userId, question, answer, res);
//             });

//             return;
//         }

//         // ---------- COURSES ----------
//         if (questionLower.includes("course")) {

//             const query = `
//                 SELECT c.title, c.level, u.full_name AS trainer
//                 FROM courses c
//                 JOIN trainer_profiles tp ON c.trainer_profile_id = tp.id
//                 JOIN users u ON tp.user_id = u.id
//                 WHERE c.status = 'published'
//                 LIMIT 5
//             `;

//             db.query(query, (err, courses) => {
//                 if (err) {
//                     return res.status(500).json({
//                         success: false,
//                         message: "Fetch courses failed"
//                     });
//                 }

//                 const answer = courses.length === 0
//                     ? "No courses available."
//                     : "Available courses:\n\n" +
//                       courses.map(c => `• ${c.title} by ${c.trainer}`).join("\n");

//                 sendAndSaveChatbotLog(userId, question, answer, res);
//             });

//             return;
//         }

//         // ---------- MY APPLICATIONS ----------
//         if (questionLower.includes("application")) {

//             if (!userId) {
//                 const answer = "Please login to view your applications.";
//                 sendAndSaveChatbotLog(userId, question, answer, res);
//                 return;
//             }

//             const query = `
//                 SELECT j.title, ja.application_status
//                 FROM job_applications ja
//                 JOIN job_seeker_profiles jsp ON ja.job_seeker_profile_id = jsp.id
//                 JOIN jobs j ON ja.job_id = j.id
//                 WHERE jsp.user_id = ?
//                 LIMIT 5
//             `;

//             db.query(query, [userId], (err, apps) => {
//                 if (err) {
//                     return res.status(500).json({
//                         success: false
//                     });
//                 }

//                 const answer = apps.length === 0
//                     ? "You have no applications."
//                     : "Your applications:\n\n" +
//                       apps.map(a => `• ${a.title} - ${a.application_status}`).join("\n");

//                 sendAndSaveChatbotLog(userId, question, answer, res);
//             });

//             return;
//         }

//         // ---------- AI FALLBACK ----------
//         const response = await axios.post(
//             "https://openrouter.ai/api/v1/chat/completions",
//             {
//                 model: process.env.OPENROUTER_MODEL || "openrouter/free",
//                 messages: [
//                     {
//                         role: "system",
//                         content: `
// You are a chatbot for Job & Skill Development Platform.

// Only answer questions related to this platform:
// - job seekers
// - employers
// - trainers
// - jobs
// - job applications
// - resumes/documents
// - courses
// - mentorship sessions
// - platform usage

// Do not answer unrelated questions like maths, politics, entertainment, or general knowledge.
// If unrelated, reply:
// "I can only help with Job & Skill Development Platform related questions."

// Platform facts:
// - Users can sign up as job seeker, employer, or trainer.
// - Job seekers can create a profile, add education, add experience, add skills, upload resumes/documents, search jobs, apply for jobs, enroll in courses, and join mentorship sessions.
// - Employers can create or manage companies, post jobs, add required job skills, and update job application status.
// - Trainers can create a trainer profile, create courses, add course materials, and create mentorship sessions.
// - Admins can manage users, jobs, categories, and analytics.
// - Resume/document upload supports PDF, DOC, DOCX, JPG, JPEG, and PNG.
// - Documents can have document_type: cv, certificate, or other.
// - Users can set one uploaded document as primary.
// - Resume parsing can extract text from PDF, DOCX, and image files.
// - Courses can contain materials such as YouTube links, external links, PDFs, documents, and images.
// - Job seekers can enroll in published courses.
// - Job seekers can join scheduled mentorship sessions.
// - Application statuses include pending, reviewed, shortlisted, rejected, accepted, and withdrawn.
// - If you do not know the exact screen name or button name, do not invent it. Explain generally.
// - Keep answers simple, clear, and helpful.
// `
//                     },
//                     {
//                         role: "user",
//                         content: question
//                     }
//                 ]
//             },
//             {
//                 headers: {
//                     Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
//                     "Content-Type": "application/json"
//                 }
//             }
//         );

//         const answer = response.data.choices[0].message.content;

//         sendAndSaveChatbotLog(userId, question, answer, res);

//     } catch (error) {
//         return res.status(500).json({
//             success: false,
//             message: "Chatbot failed",
//             error: error.message
//         });
//     }
// };

// // ---------- LOGS ----------
// const getChatbotLogs = (req, res) => {
//     const page = Number(req.query.page) || 1;
//     const limit = Number(req.query.limit) || 20;
//     const offset = (page - 1) * limit;

//     const query = `
//         SELECT cl.*, u.full_name
//         FROM chatbot_logs cl
//         LEFT JOIN users u ON cl.user_id = u.id
//         ORDER BY cl.created_at DESC
//         LIMIT ? OFFSET ?
//     `;

//     db.query(query, [limit, offset], (err, result) => {
//         if (err) {
//             return res.status(500).json({
//                 success: false
//             });
//         }

//         return res.json({
//             success: true,
//             page,
//             logs: result
//         });
//     });
// };

// module.exports = {
//     askChatbot,
//     getChatbotLogs
// };



const db = require("../db/db-connection");
const axios = require("axios");

const sendAndSaveChatbotLog = (userId, question, answer, res) => {
    const insertLogQuery = `
        INSERT INTO chatbot_logs (
            user_id,
            question,
            response
        )
        VALUES (?, ?, ?)
    `;

    db.query(insertLogQuery, [userId, question, answer], (logError) => {
        if (logError) {
            return res.status(500).json({
                success: false,
                message: "Chatbot log save failed",
                error: logError.message
            });
        }

        return res.status(200).json({
            success: true,
            question,
            answer
        });
    });
};

const extractJobSearchKeyword = (questionLower) => {
    let keyword = questionLower;

    const removeWords = [
        "show", "me", "find", "search", "jobs", "job", "vacancy", "vacancies",
        "in", "for", "available", "recent", "open", "latest", "please"
    ];

    removeWords.forEach((word) => {
        keyword = keyword.replace(new RegExp(`\\b${word}\\b`, "g"), "");
    });

    return keyword.trim();
};

const askChatbot = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : null;
        const { question } = req.body;

        if (!question) {
            return res.status(400).json({
                success: false,
                message: "question is required"
            });
        }

        const questionLower = question.toLowerCase();

        // ---------- JOB SEARCH WITH KEYWORD ----------
        if (questionLower.includes("job") || questionLower.includes("vacancy")) {
            const keyword = extractJobSearchKeyword(questionLower);

            let query = `
                SELECT 
                    j.title,
                    j.location,
                    j.work_mode,
                    j.job_type,
                    j.experience_level,
                    c.company_name
                FROM jobs j
                JOIN companies c ON j.company_id = c.id
                WHERE j.status = 'open'
            `;

            const params = [];

            if (keyword) {
                query += `
                    AND (
                        LOWER(j.title) LIKE ?
                        OR LOWER(j.description) LIKE ?
                        OR LOWER(j.location) LIKE ?
                        OR LOWER(j.work_mode) LIKE ?
                        OR LOWER(j.job_type) LIKE ?
                        OR LOWER(c.company_name) LIKE ?
                    )
                `;

                const searchValue = `%${keyword}%`;
                params.push(
                    searchValue,
                    searchValue,
                    searchValue,
                    searchValue,
                    searchValue,
                    searchValue
                );
            }

            query += `
                ORDER BY j.created_at DESC
                LIMIT 5
            `;

            db.query(query, params, (err, jobs) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: "Fetch jobs failed",
                        error: err.message
                    });
                }

                const answer = jobs.length === 0
                    ? "No matching open jobs found at the moment."
                    : "Here are some matching open jobs:\n\n" +
                      jobs.map(
                          (j) =>
                              `• ${j.title} at ${j.company_name} - ${j.location}, ${j.work_mode}, ${j.job_type}`
                      ).join("\n");

                sendAndSaveChatbotLog(userId, question, answer, res);
            });

            return;
        }

        // ---------- COURSES ----------
        if (questionLower.includes("course")) {
            const query = `
                SELECT c.title, c.level, u.full_name AS trainer
                FROM courses c
                JOIN trainer_profiles tp ON c.trainer_profile_id = tp.id
                JOIN users u ON tp.user_id = u.id
                WHERE c.status = 'published'
                LIMIT 5
            `;

            db.query(query, (err, courses) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: "Fetch courses failed"
                    });
                }

                const answer = courses.length === 0
                    ? "No courses available."
                    : "Available courses:\n\n" +
                      courses.map(c => `• ${c.title} by ${c.trainer}`).join("\n");

                sendAndSaveChatbotLog(userId, question, answer, res);
            });

            return;
        }

        // ---------- MY APPLICATIONS ----------
        if (questionLower.includes("application")) {
            if (!userId) {
                const answer = "Please login to view your applications.";
                sendAndSaveChatbotLog(userId, question, answer, res);
                return;
            }

            const query = `
                SELECT j.title, ja.application_status
                FROM job_applications ja
                JOIN job_seeker_profiles jsp ON ja.job_seeker_profile_id = jsp.id
                JOIN jobs j ON ja.job_id = j.id
                WHERE jsp.user_id = ?
                LIMIT 5
            `;

            db.query(query, [userId], (err, apps) => {
                if (err) {
                    return res.status(500).json({
                        success: false
                    });
                }

                const answer = apps.length === 0
                    ? "You have no applications."
                    : "Your applications:\n\n" +
                      apps.map(a => `• ${a.title} - ${a.application_status}`).join("\n");

                sendAndSaveChatbotLog(userId, question, answer, res);
            });

            return;
        }

        // ---------- AI FALLBACK ----------
        const response = await axios.post(
            "https://openrouter.ai/api/v1/chat/completions",
            {
                model: process.env.OPENROUTER_MODEL || "openrouter/free",
                messages: [
                    {
                        role: "system",
                        content: `
You are a chatbot for Job & Skill Development Platform.

Only answer questions related to this platform:
- job seekers
- employers
- trainers
- jobs
- job applications
- resumes/documents
- courses
- mentorship sessions
- platform usage

Do not answer unrelated questions like maths, politics, entertainment, or general knowledge.
If unrelated, reply:
"I can only help with Job & Skill Development Platform related questions."

Platform facts:
- Users can sign up as job seeker, employer, or trainer.
- Job seekers can create a profile, add education, add experience, add skills, upload resumes/documents, search jobs, apply for jobs, enroll in courses, and join mentorship sessions.
- Employers can create or manage companies, post jobs, add required job skills, and update job application status.
- Trainers can create a trainer profile, create courses, add course materials, and create mentorship sessions.
- Resume/document upload supports PDF, DOC, DOCX, JPG, JPEG, and PNG.
- Documents can have document_type: cv, certificate, or other.
- Users can set one uploaded document as primary.
- Resume parsing can extract text from PDF, DOCX, and image files.
- Courses can contain materials such as YouTube links, external links, PDFs, documents, and images.
- Job seekers can enroll in published courses.
- Job seekers can join scheduled mentorship sessions.
- Application statuses include pending, reviewed, shortlisted, rejected, accepted, and withdrawn.
- If you do not know the exact screen name or button name, do not invent it. Explain generally.
- Keep answers simple, clear, and helpful.
`
                    },
                    {
                        role: "user",
                        content: question
                    }
                ]
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const answer = response.data.choices[0].message.content;

        sendAndSaveChatbotLog(userId, question, answer, res);
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Chatbot failed",
            error: error.message
        });
    }
};

const getChatbotLogs = (req, res) => {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const query = `
        SELECT cl.*, u.full_name
        FROM chatbot_logs cl
        LEFT JOIN users u ON cl.user_id = u.id
        ORDER BY cl.created_at DESC
        LIMIT ? OFFSET ?
    `;

    db.query(query, [limit, offset], (err, result) => {
        if (err) {
            return res.status(500).json({
                success: false
            });
        }

        return res.json({
            success: true,
            page,
            limit,
            logs: result
        });
    });
};

module.exports = {
    askChatbot,
    getChatbotLogs
};