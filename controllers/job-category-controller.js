const db = require("../db/db-connection");

// ADD CATEGORY
const addCategory = (req, res) => {
    try {
        const { category_name } = req.body;

        if (!category_name) {
            return res.status(400).json({
                success: false,
                message: "Category name is required"
            });
        }

        const trimmedCategoryName = category_name.trim();

        const checkCategoryQuery = `
            SELECT * FROM job_categories
            WHERE LOWER(category_name) = LOWER(?)
            LIMIT 1
        `;

        db.query(checkCategoryQuery, [trimmedCategoryName], (checkError, checkResult) => {
            if (checkError) {
                return res.status(500).json({
                    success: false,
                    message: "Category check failed",
                    error: checkError.message
                });
            }

            if (checkResult.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: "Category already exists"
                });
            }

            const insertCategoryQuery = `
                INSERT INTO job_categories (category_name)
                VALUES (?)
            `;

            db.query(insertCategoryQuery, [trimmedCategoryName], (insertError, insertResult) => {
                if (insertError) {
                    return res.status(500).json({
                        success: false,
                        message: "Category add failed",
                        error: insertError.message
                    });
                }

                return res.status(201).json({
                    success: true,
                    message: "Category added successfully",
                    category_id: insertResult.insertId
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Add category failed",
            error: error.message
        });
    }
};

// GET ALL CATEGORIES
const getAllCategories = (req, res) => {
    try {
        const getCategoriesQuery = `
            SELECT *
            FROM job_categories
            ORDER BY category_name ASC
        `;

        db.query(getCategoriesQuery, (error, result) => {
            if (error) {
                return res.status(500).json({
                    success: false,
                    message: "Fetch categories failed",
                    error: error.message
                });
            }

            return res.status(200).json({
                success: true,
                categories: result
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Get categories failed",
            error: error.message
        });
    }
};

// GET SINGLE CATEGORY
const getSingleCategory = (req, res) => {
    try {
        const categoryId = req.params.id;

        const getCategoryQuery = `
            SELECT *
            FROM job_categories
            WHERE id = ?
            LIMIT 1
        `;

        db.query(getCategoryQuery, [categoryId], (error, result) => {
            if (error) {
                return res.status(500).json({
                    success: false,
                    message: "Fetch category failed",
                    error: error.message
                });
            }

            if (result.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Category not found"
                });
            }

            return res.status(200).json({
                success: true,
                category: result[0]
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Get category failed",
            error: error.message
        });
    }
};

// UPDATE CATEGORY
const updateCategory = (req, res) => {
    try {
        const categoryId = req.params.id;
        const { category_name } = req.body;

        if (!category_name) {
            return res.status(400).json({
                success: false,
                message: "Category name is required"
            });
        }

        const trimmedCategoryName = category_name.trim();

        const getCategoryQuery = `
            SELECT * FROM job_categories
            WHERE id = ?
            LIMIT 1
        `;

        db.query(getCategoryQuery, [categoryId], (fetchError, fetchResult) => {
            if (fetchError) {
                return res.status(500).json({
                    success: false,
                    message: "Category fetch failed",
                    error: fetchError.message
                });
            }

            if (fetchResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Category not found"
                });
            }

            const checkDuplicateQuery = `
                SELECT * FROM job_categories
                WHERE LOWER(category_name) = LOWER(?) AND id != ?
                LIMIT 1
            `;

            db.query(checkDuplicateQuery, [trimmedCategoryName, categoryId], (checkError, checkResult) => {
                if (checkError) {
                    return res.status(500).json({
                        success: false,
                        message: "Category duplicate check failed",
                        error: checkError.message
                    });
                }

                if (checkResult.length > 0) {
                    return res.status(400).json({
                        success: false,
                        message: "Another category with this name already exists"
                    });
                }

                const updateCategoryQuery = `
                    UPDATE job_categories
                    SET category_name = ?
                    WHERE id = ?
                `;

                db.query(updateCategoryQuery, [trimmedCategoryName, categoryId], (updateError) => {
                    if (updateError) {
                        return res.status(500).json({
                            success: false,
                            message: "Category update failed",
                            error: updateError.message
                        });
                    }

                    return res.status(200).json({
                        success: true,
                        message: "Category updated successfully"
                    });
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Update category failed",
            error: error.message
        });
    }
};

// DELETE CATEGORY
const deleteCategory = (req, res) => {
    try {
        const categoryId = req.params.id;

        const getCategoryQuery = `
            SELECT * FROM job_categories
            WHERE id = ?
            LIMIT 1
        `;

        db.query(getCategoryQuery, [categoryId], (fetchError, fetchResult) => {
            if (fetchError) {
                return res.status(500).json({
                    success: false,
                    message: "Category fetch failed",
                    error: fetchError.message
                });
            }

            if (fetchResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Category not found"
                });
            }

            const deleteCategoryQuery = `
                DELETE FROM job_categories
                WHERE id = ?
            `;

            db.query(deleteCategoryQuery, [categoryId], (deleteError, deleteResult) => {
                if (deleteError) {
                    return res.status(500).json({
                        success: false,
                        message: "Category delete failed",
                        error: deleteError.message
                    });
                }

                if (deleteResult.affectedRows === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Category not found"
                    });
                }

                return res.status(200).json({
                    success: true,
                    message: "Category deleted successfully"
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Delete category failed",
            error: error.message
        });
    }
};

module.exports = {
    addCategory,
    getAllCategories,
    getSingleCategory,
    updateCategory,
    deleteCategory
};