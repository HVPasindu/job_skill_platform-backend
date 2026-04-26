const db = require("../db/db-connection");
const fs = require("fs");
const axios = require("axios");
const { PDFParse } = require("pdf-parse");
const Tesseract = require("tesseract.js");
const mammoth = require("mammoth");

const getLocalFilePathFromUrl = (fileUrl) => {
    try {
        const urlObj = new URL(fileUrl);
        return decodeURIComponent(urlObj.pathname.substring(1));
    } catch {
        return fileUrl;
    }
};

const extractTextFromImage = async (filePath) => {
    const result = await Tesseract.recognize(filePath, "eng");
    return result.data.text;
};

const extractTextFromFile = async (filePath, fileType) => {
    if (fileType === "application/pdf") {
        const buffer = fs.readFileSync(filePath);
        const parser = new PDFParse({ data: buffer });
        const result = await parser.getText();
        return result.text;
    }

    if (
        fileType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value;
    }

    if (
        fileType === "image/jpeg" ||
        fileType === "image/jpg" ||
        fileType === "image/png" ||
        fileType === "image/webp"
    ) {
        return await extractTextFromImage(filePath);
    }

    throw new Error("Only PDF, DOCX and image OCR parsing is supported now");
};

const parseTextWithAI = async (extractedText) => {
    if (!process.env.OPENROUTER_API_KEY) {
        throw new Error("OPENROUTER_API_KEY is missing in .env");
    }

    const response = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
            model: process.env.OPENROUTER_MODEL || "openrouter/free",
            messages: [
                {
                    role: "system",
                    content: `
You are a resume parser.
Return only valid JSON.
Do not include markdown.
Do not include explanations.
`
                },
                {
                    role: "user",
                    content: `
Extract resume data from this text.

Return only this JSON structure:
{
  "skills": [
    {
      "skill_name": "",
      "proficiency_level": "",
      "years_of_experience": 0
    }
  ],
  "experience": [
    {
      "job_title": "",
      "company_name": "",
      "start_date": "",
      "end_date": "",
      "description": ""
    }
  ],
  "education": [
    {
      "qualification": "",
      "institute_name": "",
      "field_of_study": "",
      "start_date": "",
      "end_date": "",
      "grade": "",
      "description": ""
    }
  ]
}

Resume text:
${extractedText}
`
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

    const aiText = response.data.choices?.[0]?.message?.content;

    if (!aiText) {
        throw new Error("AI response is empty");
    }

    try {
        return JSON.parse(aiText);
    } catch {
        const jsonMatch = aiText.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
            throw new Error("AI response is not valid JSON");
        }

        return JSON.parse(jsonMatch[0]);
    }
};

const saveParseResult = (resumeId, extractedText, aiResult, res, extraData = {}) => {
    const saveQuery = `
        INSERT INTO resume_parsing_results (
            resume_id,
            extracted_text,
            parsed_skills_json,
            parsed_experience_json,
            parsed_education_json
        )
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            extracted_text = VALUES(extracted_text),
            parsed_skills_json = VALUES(parsed_skills_json),
            parsed_experience_json = VALUES(parsed_experience_json),
            parsed_education_json = VALUES(parsed_education_json)
    `;

    db.query(
        saveQuery,
        [
            resumeId,
            extractedText,
            JSON.stringify(aiResult.skills || []),
            JSON.stringify(aiResult.experience || []),
            JSON.stringify(aiResult.education || [])
        ],
        (saveError) => {
            if (saveError) {
                return res.status(500).json({
                    success: false,
                    message: "Resume parsing result save failed",
                    error: saveError.message
                });
            }

            return res.status(200).json({
                success: true,
                message: "Resume parsed successfully",
                resume_id: resumeId,
                extracted_text_length: extractedText.length,
                parsed_skills: aiResult.skills || [],
                parsed_experience: aiResult.experience || [],
                parsed_education: aiResult.education || [],
                ...extraData
            });
        }
    );
};

// PARSE SPECIFIC RESUME
const parseResume = (req, res) => {
    try {
        const userId = req.user.id;
        const resumeId = req.params.resumeId;

        const getResumeQuery = `
            SELECT r.*
            FROM resumes r
            JOIN job_seeker_profiles jsp
                ON r.job_seeker_profile_id = jsp.id
            WHERE r.id = ?
              AND jsp.user_id = ?
            LIMIT 1
        `;

        db.query(getResumeQuery, [resumeId, userId], async (resumeError, resumeResult) => {
            if (resumeError) {
                return res.status(500).json({
                    success: false,
                    message: "Resume fetch failed",
                    error: resumeError.message
                });
            }

            if (resumeResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Resume not found or not allowed"
                });
            }

            const resume = resumeResult[0];
            const filePath = getLocalFilePathFromUrl(resume.file_url);

            if (!fs.existsSync(filePath)) {
                return res.status(404).json({
                    success: false,
                    message: "Resume file not found on server"
                });
            }

            let extractedText = "";

            try {
                extractedText = await extractTextFromFile(filePath, resume.file_type);
            } catch (extractError) {
                return res.status(400).json({
                    success: false,
                    message: extractError.message
                });
            }

            let aiResult;

            try {
                aiResult = await parseTextWithAI(extractedText);
            } catch (aiError) {
                return res.status(500).json({
                    success: false,
                    message: "AI parsing failed",
                    error: aiError.message
                });
            }

            return saveParseResult(resumeId, extractedText, aiResult, res, {
                parse_mode: "specific_resume",
                document_type: resume.document_type
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Parse resume failed",
            error: error.message
        });
    }
};

// AUTO PARSE
const parseAutoResume = (req, res) => {
    try {
        const userId = req.user.id;

        const getCvQuery = `
            SELECT r.*
            FROM resumes r
            JOIN job_seeker_profiles jsp
                ON r.job_seeker_profile_id = jsp.id
            WHERE jsp.user_id = ?
              AND r.document_type = 'cv'
            ORDER BY r.uploaded_at DESC, r.id DESC
            LIMIT 1
        `;

        db.query(getCvQuery, [userId], async (cvError, cvResult) => {
            if (cvError) {
                return res.status(500).json({
                    success: false,
                    message: "CV fetch failed",
                    error: cvError.message
                });
            }

            if (cvResult.length > 0) {
                const cv = cvResult[0];
                const filePath = getLocalFilePathFromUrl(cv.file_url);

                if (!fs.existsSync(filePath)) {
                    return res.status(404).json({
                        success: false,
                        message: "CV file not found on server"
                    });
                }

                let extractedText = "";

                try {
                    extractedText = await extractTextFromFile(filePath, cv.file_type);
                } catch (extractError) {
                    return res.status(400).json({
                        success: false,
                        message: extractError.message
                    });
                }

                let aiResult;

                try {
                    aiResult = await parseTextWithAI(extractedText);
                } catch (aiError) {
                    return res.status(500).json({
                        success: false,
                        message: "AI parsing failed",
                        error: aiError.message
                    });
                }

                return saveParseResult(cv.id, extractedText, aiResult, res, {
                    parse_mode: "cv",
                    document_type: cv.document_type
                });
            }

            const getPrimaryDocsQuery = `
                SELECT r.*
                FROM resumes r
                JOIN job_seeker_profiles jsp
                    ON r.job_seeker_profile_id = jsp.id
                WHERE jsp.user_id = ?
                  AND r.is_primary = true
                ORDER BY r.uploaded_at DESC, r.id DESC
            `;

            db.query(getPrimaryDocsQuery, [userId], async (primaryError, primaryResult) => {
                if (primaryError) {
                    return res.status(500).json({
                        success: false,
                        message: "Primary documents fetch failed",
                        error: primaryError.message
                    });
                }

                if (primaryResult.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "No CV or primary documents found"
                    });
                }

                let combinedText = "";
                const parsedDocuments = [];
                const skippedDocuments = [];

                for (const doc of primaryResult) {
                    const filePath = getLocalFilePathFromUrl(doc.file_url);

                    if (!fs.existsSync(filePath)) {
                        skippedDocuments.push({
                            resume_id: doc.id,
                            file_name: doc.file_name,
                            reason: "File not found on server"
                        });
                        continue;
                    }

                    try {
                        const text = await extractTextFromFile(filePath, doc.file_type);

                        combinedText += `\n\n--- DOCUMENT: ${doc.file_name} (${doc.document_type}) ---\n\n`;
                        combinedText += text;

                        parsedDocuments.push({
                            resume_id: doc.id,
                            file_name: doc.file_name,
                            document_type: doc.document_type,
                            extracted_text_length: text.length
                        });
                    } catch (error) {
                        skippedDocuments.push({
                            resume_id: doc.id,
                            file_name: doc.file_name,
                            document_type: doc.document_type,
                            reason: error.message
                        });
                    }
                }

                if (!combinedText.trim()) {
                    return res.status(400).json({
                        success: false,
                        message: "No supported primary documents could be parsed",
                        skipped_documents: skippedDocuments
                    });
                }

                const representativeResumeId = parsedDocuments[0].resume_id;

                let aiResult;

                try {
                    aiResult = await parseTextWithAI(combinedText);
                } catch (aiError) {
                    return res.status(500).json({
                        success: false,
                        message: "AI parsing failed",
                        error: aiError.message
                    });
                }

                return saveParseResult(representativeResumeId, combinedText, aiResult, res, {
                    parse_mode: "primary_documents_combined",
                    parsed_documents: parsedDocuments,
                    skipped_documents: skippedDocuments
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Auto parse resume failed",
            error: error.message
        });
    }
};

//Me API eka backend eken decide karanawa:

//CV parse result thiyenawanam latest CV result eka denna
//CV nathnam latest parsed result eka denna
//nathnam “parse result not found” denna
const getLatestResumeParseResult = (req, res) => {
    try {
        const userId = req.user.id;

        const query = `
            SELECT
                rpr.*,
                r.document_type,
                r.file_name,
                r.is_primary
            FROM resume_parsing_results rpr
            JOIN resumes r ON rpr.resume_id = r.id
            JOIN job_seeker_profiles jsp ON r.job_seeker_profile_id = jsp.id
            WHERE jsp.user_id = ?
            ORDER BY
                CASE WHEN r.document_type = 'cv' THEN 0 ELSE 1 END,
                rpr.updated_at DESC,
                rpr.id DESC
            LIMIT 1
        `;

        db.query(query, [userId], (error, result) => {
            if (error) {
                return res.status(500).json({
                    success: false,
                    message: "Fetch latest parse result failed",
                    error: error.message
                });
            }

            if (result.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "No parse result found"
                });
            }

            return res.status(200).json({
                success: true,
                parse_result: result[0]
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Get latest parse result failed",
            error: error.message
        });
    }
};

// GET PARSE RESULT with id
const getResumeParseResult = (req, res) => {
    try {
        const userId = req.user.id;
        const resumeId = req.params.resumeId;

        const query = `
            SELECT rpr.*
            FROM resume_parsing_results rpr
            JOIN resumes r ON rpr.resume_id = r.id
            JOIN job_seeker_profiles jsp
                ON r.job_seeker_profile_id = jsp.id
            WHERE rpr.resume_id = ?
              AND jsp.user_id = ?
            LIMIT 1
        `;

        db.query(query, [resumeId, userId], (error, result) => {
            if (error) {
                return res.status(500).json({
                    success: false,
                    message: "Fetch parse result failed",
                    error: error.message
                });
            }

            if (result.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Parse result not found"
                });
            }

            return res.status(200).json({
                success: true,
                parse_result: result[0]
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Get parse result failed",
            error: error.message
        });
    }
};

module.exports = {
    parseResume,
    parseAutoResume,
    getLatestResumeParseResult,
    getResumeParseResult
};