const db = require("../db/db-connection");

// ADD COURSE MATERIAL (PARENT)
const createCourseMaterial = (req, res) => {
    try {
        const userId = req.user.id;
        const courseId = req.params.courseId;

        const {
            title,
            material_type,
            external_url,
            sort_order
        } = req.body;

        if (!title || !material_type) {
            return res.status(400).json({
                success: false,
                message: "title and material_type are required"
            });
        }

        const trimmedTitle = title.trim();

        const getCourseQuery = `
            SELECT c.*, tp.user_id
            FROM courses c
            JOIN trainer_profiles tp ON c.trainer_profile_id = tp.id
            WHERE c.id = ?
            LIMIT 1
        `;

        db.query(getCourseQuery, [courseId], (courseError, courseResult) => {
            if (courseError) {
                return res.status(500).json({
                    success: false,
                    message: "Course fetch failed",
                    error: courseError.message
                });
            }

            if (courseResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Course not found"
                });
            }

            const course = courseResult[0];

            if (Number(course.user_id) !== Number(userId)) {
                return res.status(403).json({
                    success: false,
                    message: "You are not allowed to add materials to this course"
                });
            }

            const checkDuplicateQuery = `
                SELECT * FROM course_materials
                WHERE course_id = ?
                  AND LOWER(title) = LOWER(?)
                LIMIT 1
            `;

            db.query(checkDuplicateQuery, [courseId, trimmedTitle], (checkError, checkResult) => {
                if (checkError) {
                    return res.status(500).json({
                        success: false,
                        message: "Course material duplicate check failed",
                        error: checkError.message
                    });
                }

                if (checkResult.length > 0) {
                    return res.status(400).json({
                        success: false,
                        message: "This material title already exists in this course"
                    });
                }

                const insertQuery = `
                    INSERT INTO course_materials (
                        course_id,
                        title,
                        material_type,
                        external_url,
                        sort_order
                    )
                    VALUES (?, ?, ?, ?, ?)
                `;

                db.query(
                    insertQuery,
                    [
                        courseId,
                        trimmedTitle,
                        material_type,
                        external_url || null,
                        sort_order || null
                    ],
                    (insertError, insertResult) => {
                        if (insertError) {
                            return res.status(500).json({
                                success: false,
                                message: "Course material create failed",
                                error: insertError.message
                            });
                        }

                        return res.status(201).json({
                            success: true,
                            message: "Course material created successfully",
                            material_id: insertResult.insertId
                        });
                    }
                );
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Create course material failed",
            error: error.message
        });
    }
};

// GET COURSE MATERIALS (PUBLIC)
const getCourseMaterials = (req, res) => {
    try {
        const courseId = req.params.courseId;

        const query = `
            SELECT *
            FROM course_materials
            WHERE course_id = ?
            ORDER BY
                CASE WHEN sort_order IS NULL THEN 1 ELSE 0 END,
                sort_order ASC,
                id ASC
        `;

        db.query(query, [courseId], (error, result) => {
            if (error) {
                return res.status(500).json({
                    success: false,
                    message: "Fetch course materials failed",
                    error: error.message
                });
            }

            return res.status(200).json({
                success: true,
                materials: result
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Get course materials failed",
            error: error.message
        });
    }
};

// GET SINGLE COURSE MATERIAL (PUBLIC)
const getSingleCourseMaterial = (req, res) => {
    try {
        const materialId = req.params.materialId;

        const query = `
            SELECT *
            FROM course_materials
            WHERE id = ?
            LIMIT 1
        `;

        db.query(query, [materialId], (error, result) => {
            if (error) {
                return res.status(500).json({
                    success: false,
                    message: "Fetch course material failed",
                    error: error.message
                });
            }

            if (result.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Course material not found"
                });
            }

            return res.status(200).json({
                success: true,
                material: result[0]
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Get single course material failed",
            error: error.message
        });
    }
};

// UPDATE COURSE MATERIAL
const updateCourseMaterial = (req, res) => {
    try {
        const userId = req.user.id;
        const materialId = req.params.materialId;

        const {
            title,
            material_type,
            external_url,
            sort_order
        } = req.body;

        const getMaterialQuery = `
            SELECT cm.*, tp.user_id
            FROM course_materials cm
            JOIN courses c ON cm.course_id = c.id
            JOIN trainer_profiles tp ON c.trainer_profile_id = tp.id
            WHERE cm.id = ?
            LIMIT 1
        `;

        db.query(getMaterialQuery, [materialId], (fetchError, fetchResult) => {
            if (fetchError) {
                return res.status(500).json({
                    success: false,
                    message: "Course material fetch failed",
                    error: fetchError.message
                });
            }

            if (fetchResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Course material not found"
                });
            }

            const existingMaterial = fetchResult[0];

            if (Number(existingMaterial.user_id) !== Number(userId)) {
                return res.status(403).json({
                    success: false,
                    message: "You are not allowed to update this course material"
                });
            }

            const updatedTitle =
                title !== undefined ? title.trim() : existingMaterial.title;

            const updatedMaterialType =
                material_type !== undefined ? material_type : existingMaterial.material_type;

            const updatedExternalUrl =
                external_url !== undefined ? external_url : existingMaterial.external_url;

            const updatedSortOrder =
                sort_order !== undefined ? sort_order : existingMaterial.sort_order;

            const checkDuplicateQuery = `
                SELECT * FROM course_materials
                WHERE course_id = ?
                  AND LOWER(title) = LOWER(?)
                  AND id != ?
                LIMIT 1
            `;

            db.query(
                checkDuplicateQuery,
                [existingMaterial.course_id, updatedTitle, materialId],
                (duplicateError, duplicateResult) => {
                    if (duplicateError) {
                        return res.status(500).json({
                            success: false,
                            message: "Course material duplicate check failed",
                            error: duplicateError.message
                        });
                    }

                    if (duplicateResult.length > 0) {
                        return res.status(400).json({
                            success: false,
                            message: "Another material with this title already exists in this course"
                        });
                    }

                    const updateQuery = `
                        UPDATE course_materials
                        SET
                            title = ?,
                            material_type = ?,
                            external_url = ?,
                            sort_order = ?
                        WHERE id = ?
                    `;

                    db.query(
                        updateQuery,
                        [
                            updatedTitle,
                            updatedMaterialType,
                            updatedExternalUrl,
                            updatedSortOrder,
                            materialId
                        ],
                        (updateError) => {
                            if (updateError) {
                                return res.status(500).json({
                                    success: false,
                                    message: "Course material update failed",
                                    error: updateError.message
                                });
                            }

                            return res.status(200).json({
                                success: true,
                                message: "Course material updated successfully"
                            });
                        }
                    );
                }
            );
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Update course material failed",
            error: error.message
        });
    }
};

// DELETE COURSE MATERIAL
const deleteCourseMaterial = (req, res) => {
    try {
        const userId = req.user.id;
        const materialId = req.params.materialId;

        const getMaterialQuery = `
            SELECT cm.*, tp.user_id
            FROM course_materials cm
            JOIN courses c ON cm.course_id = c.id
            JOIN trainer_profiles tp ON c.trainer_profile_id = tp.id
            WHERE cm.id = ?
            LIMIT 1
        `;

        db.query(getMaterialQuery, [materialId], (fetchError, fetchResult) => {
            if (fetchError) {
                return res.status(500).json({
                    success: false,
                    message: "Course material fetch failed",
                    error: fetchError.message
                });
            }

            if (fetchResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Course material not found"
                });
            }

            const existingMaterial = fetchResult[0];

            if (Number(existingMaterial.user_id) !== Number(userId)) {
                return res.status(403).json({
                    success: false,
                    message: "You are not allowed to delete this course material"
                });
            }

            const deleteQuery = `
                DELETE FROM course_materials
                WHERE id = ?
            `;

            db.query(deleteQuery, [materialId], (deleteError) => {
                if (deleteError) {
                    return res.status(500).json({
                        success: false,
                        message: "Course material delete failed",
                        error: deleteError.message
                    });
                }

                return res.status(200).json({
                    success: true,
                    message: "Course material deleted successfully"
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Delete course material failed",
            error: error.message
        });
    }
};

module.exports = {
    createCourseMaterial,
    getCourseMaterials,
    getSingleCourseMaterial,
    updateCourseMaterial,
    deleteCourseMaterial
};