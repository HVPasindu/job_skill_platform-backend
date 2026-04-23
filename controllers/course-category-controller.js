const db = require("../db/db-connection");

// CREATE CATEGORY (ADMIN / TRAINER)
const createCourseCategory = (req, res) => {
    try {
        let { category_name } = req.body;

        if (!category_name) {
            return res.status(400).json({
                success: false,
                message: "Category name is required"
            });
        }

        // normalize (duplicate avoid)
        const normalized = category_name.trim().toLowerCase();

        const checkQuery = `
            SELECT * FROM course_categories
            WHERE LOWER(category_name) = ?
            LIMIT 1
        `;

        db.query(checkQuery, [normalized], (checkErr, checkRes) => {
            if (checkErr) {
                return res.status(500).json({
                    success: false,
                    message: "Category check failed",
                    error: checkErr.message
                });
            }

            if (checkRes.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: "Category already exists"
                });
            }

            const insertQuery = `
                INSERT INTO course_categories (category_name)
                VALUES (?)
            `;

            db.query(insertQuery, [normalized], (insertErr, result) => {
                if (insertErr) {
                    return res.status(500).json({
                        success: false,
                        message: "Category create failed",
                        error: insertErr.message
                    });
                }

                return res.status(201).json({
                    success: true,
                    message: "Category created successfully",
                    category: {
                        id: result.insertId,
                        category_name: normalized
                    }
                });
            });
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Create category failed",
            error: error.message
        });
    }
};

// GET ALL CATEGORIES
const getAllCourseCategories = (req, res) => {
    const query = `
        SELECT id, category_name
        FROM course_categories
        ORDER BY category_name ASC
    `;

    db.query(query, (err, result) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: "Fetch categories failed",
                error: err.message
            });
        }

        return res.json({
            success: true,
            categories: result
        });
    });
};

module.exports = {
    createCourseCategory,
    getAllCourseCategories
};