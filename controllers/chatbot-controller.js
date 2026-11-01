const db = require("../db/db-connection");
const axios = require("axios");
const sendList = require("../utils/paginated-list");

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
        error: logError.message,
      });
    }

    return res.status(200).json({
      success: true,
      question,
      answer,
    });
  });
};

const extractJobSearchKeyword = (questionLower) => {
  let keyword = questionLower;

  const removeWords = [
    "show",
    "me",
    "find",
    "search",
    "jobs",
    "job",
    "vacancy",
    "vacancies",
    "in",
    "for",
    "available",
    "recent",
    "open",
    "latest",
    "please",
  ];

  removeWords.forEach((word) => {
    keyword = keyword.replace(new RegExp(`\\b${word}\\b`, "g"), "");
  });

  return keyword
    .replace(/[^\p{L}\p{N}\s+#.-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const askChatbot = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const question =
      typeof req.body?.question === "string"
        ? req.body.question.trim()
        : req.body?.question;

    if (
      typeof question !== "string" ||
      !question.trim() ||
      question.trim().length > 2000
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a question from 1 to 2000 characters",
      });
    }

    const questionLower = question.toLowerCase();

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
                ORDER BY ja.created_at DESC, ja.id DESC
                LIMIT 5
            `;

      db.query(query, [userId], (err, apps) => {
        if (err) {
          return res.status(500).json({
            success: false,
            message: "Fetch applications failed",
          });
        }

        const answer =
          apps.length === 0
            ? "You have no applications."
            : "Your applications:\n\n" +
              apps
                .map((a) => `• ${a.title} - ${a.application_status}`)
                .join("\n");

        sendAndSaveChatbotLog(userId, question, answer, res);
      });

      return;
    }

    // ---------- JOB SEARCH WITH KEYWORD ----------
    if (/\b(jobs?|vacanc(?:y|ies))\b/.test(questionLower)) {
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
                  AND (j.application_deadline IS NULL OR DATE(j.application_deadline) >= CURRENT_DATE())
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
          searchValue,
        );
      }

      query += `
                ORDER BY j.created_at DESC, j.id DESC
                LIMIT 5
            `;

      db.query(query, params, (err, jobs) => {
        if (err) {
          return res.status(500).json({
            success: false,
            message: "Fetch jobs failed",
            error: err.message,
          });
        }

        const answer =
          jobs.length === 0
            ? "No matching open jobs found at the moment."
            : "Here are some matching open jobs:\n\n" +
              jobs
                .map(
                  (j) =>
                    `• ${j.title} at ${j.company_name} - ${j.location}, ${j.work_mode}, ${j.job_type}`,
                )
                .join("\n");

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
                ORDER BY c.created_at DESC, c.id DESC
                LIMIT 5
            `;

      db.query(query, (err, courses) => {
        if (err) {
          return res.status(500).json({
            success: false,
            message: "Fetch courses failed",
          });
        }

        const answer =
          courses.length === 0
            ? "No courses available."
            : "Available courses:\n\n" +
              courses.map((c) => `• ${c.title} by ${c.trainer}`).join("\n");

        sendAndSaveChatbotLog(userId, question, answer, res);
      });

      return;
    }

    // ---------- AI FALLBACK ----------
    if (!process.env.OPENROUTER_API_KEY) {
      return res
        .status(503)
        .json({
          success: false,
          message:
            "AI help is not configured yet. Try Show jobs, Show courses, or My applications.",
        });
    }
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
- Live database results are handled separately. Never invent job listings, course availability, application statuses, or private account information.
- You receive only this question, not conversation history. Do not claim to remember earlier questions.
- If you do not know the exact screen name or button name, do not invent it. Explain generally.
- Keep answers simple, clear, and helpful.
`,
          },
          {
            role: "user",
            content: question,
          },
        ],
      },
      {
        timeout: 20000,
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    const answer = response.data?.choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim()) {
      return res
        .status(502)
        .json({
          success: false,
          message: "AI returned no answer. Please try again.",
        });
    }

    sendAndSaveChatbotLog(userId, question, answer, res);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message:
        error.code === "ECONNABORTED"
          ? "AI help took too long. Try again or use the Jobs and Courses pages."
          : "AI help is unavailable right now. Jobs, courses and application questions still work.",
    });
  }
};

// Keep page/limit for existing callers; use the shared validated paging/count helper.
const getChatbotLogs = (req, res) => {
  const query = req.query || {};
  const page = query.page === undefined ? "1" : query.page;
  const size =
    query.per_page === undefined
      ? query.limit === undefined
        ? "20"
        : query.limit
      : query.per_page;
  const search = typeof query.search === "string" ? query.search.trim() : "";
  if (
    search.length > 200 ||
    (query.user_type !== undefined &&
      !["", "linked", "unlinked"].includes(query.user_type))
  ) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid log filters" });
  }
  let where = " WHERE 1=1";
  const params = [];
  if (query.user_type === "linked") where += " AND cl.user_id IS NOT NULL";
  if (query.user_type === "unlinked") where += " AND cl.user_id IS NULL";
  if (search) {
    where +=
      " AND (cl.question LIKE ? OR cl.response LIKE ? OR u.full_name LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  const from =
    " FROM chatbot_logs cl LEFT JOIN users u ON cl.user_id=u.id" + where;
  return sendList(
    { query: { page, per_page: size } },
    {
      status(code) {
        res.status(code);
        return this;
      },
      json(body) {
        return res.json(
          body.success
            ? { ...body, page: Number(page), limit: Number(size) }
            : body,
        );
      },
    },
    {
      sql:
        "SELECT cl.*, u.full_name" +
        from +
        " ORDER BY cl.created_at DESC, cl.id DESC",
      countSql: "SELECT COUNT(*) AS total" + from,
      params,
      key: "logs",
    },
  );
};

module.exports = {
  askChatbot,
  getChatbotLogs,
};
