const db = require("../db/db-connection");
const fs = require("fs");

const getFileTypeFromMimetype = (mimetype) => {
    if (!mimetype) return null;

    if (mimetype === "application/pdf") {
        return "pdf";
    }

    if (
        mimetype === "image/jpeg" ||
        mimetype === "image/jpg" ||
        mimetype === "image/png" ||
        mimetype === "image/webp"
    ) {
        return "image";
    }

    if (
        mimetype === "application/msword" ||
        mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
        return "doc";
    }

    return null;
};

// ADD MULTIPLE FILES / SINGLE LINK
const addMaterialFiles = (req, res) => {
    try {
        const userId = req.user.id;
        const materialId = req.params.materialId;
        const { external_url, file_type } = req.body;

        const uploadedFiles = req.files || [];

        if (uploadedFiles.length === 0 && !external_url) {
            return res.status(400).json({
                success: false,
                message: "At least one file or external_url is required"
            });
        }

        const checkQuery = `
            SELECT cm.*, tp.user_id
            FROM course_materials cm
            JOIN courses c ON cm.course_id = c.id
            JOIN trainer_profiles tp ON c.trainer_profile_id = tp.id
            WHERE cm.id = ?
            LIMIT 1
        `;

        db.query(checkQuery, [materialId], (checkError, checkResult) => {
            if (checkError) {
                return res.status(500).json({
                    success: false,
                    message: "Material check failed",
                    error: checkError.message
                });
            }

            if (checkResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Material not found"
                });
            }

            if (Number(checkResult[0].user_id) !== Number(userId)) {
                return res.status(403).json({
                    success: false,
                    message: "You are not allowed to add files to this material"
                });
            }

            const values = [];

            // uploaded files -> separate DB rows
            uploadedFiles.forEach((file) => {
                const fileUrl = `${req.protocol}://${req.get("host")}/${file.path.replace(/\\/g, "/")}`;
                const detectedType = getFileTypeFromMimetype(file.mimetype);

                values.push([
                    materialId,
                    fileUrl,
                    null,
                    detectedType
                ]);
            });

            // external link -> one DB row
            if (external_url) {
                values.push([
                    materialId,
                    null,
                    external_url,
                    file_type || "link"
                ]);
            }

            const insertQuery = `
                INSERT INTO course_material_files (
                    course_material_id,
                    file_url,
                    external_url,
                    file_type
                )
                VALUES ?
            `;

            db.query(insertQuery, [values], (insertError, insertResult) => {
                if (insertError) {
                    return res.status(500).json({
                        success: false,
                        message: "Material files create failed",
                        error: insertError.message
                    });
                }

                return res.status(201).json({
                    success: true,
                    message: "Material files added successfully",
                    inserted_count: values.length,
                    first_insert_id: insertResult.insertId
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Add material files failed",
            error: error.message
        });
    }
};

// GET FILES (PUBLIC)
const getMaterialFiles = (req, res) => {
    try {
        const materialId = req.params.materialId;

        const query = `
            SELECT *
            FROM course_material_files
            WHERE course_material_id = ?
            ORDER BY id ASC
        `;

        db.query(query, [materialId], (err, result) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "Fetch material files failed",
                    error: err.message
                });
            }

            return res.status(200).json({
                success: true,
                files: result
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Get material files failed",
            error: error.message
        });
    }
};

// UPDATE SINGLE FILE RECORD
const updateMaterialFile = (req, res) => {
    try {
        const userId = req.user.id;
        const fileId = req.params.fileId;
        const { external_url, file_type } = req.body;

        const uploadedFiles = req.files || [];
        const newFile = uploadedFiles.length > 0 ? uploadedFiles[0] : null;

        const getQuery = `
            SELECT f.*, tp.user_id
            FROM course_material_files f
            JOIN course_materials cm ON f.course_material_id = cm.id
            JOIN courses c ON cm.course_id = c.id
            JOIN trainer_profiles tp ON c.trainer_profile_id = tp.id
            WHERE f.id = ?
            LIMIT 1
        `;

        db.query(getQuery, [fileId], (err, result) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "File fetch failed",
                    error: err.message
                });
            }

            if (result.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "File not found"
                });
            }

            const existing = result[0];

            if (Number(existing.user_id) !== Number(userId)) {
                return res.status(403).json({
                    success: false,
                    message: "You are not allowed to update this file"
                });
            }

            let updatedFileUrl = existing.file_url;
            let updatedExternalUrl = external_url !== undefined ? external_url : existing.external_url;
            let updatedFileType = file_type !== undefined ? file_type : existing.file_type;

            if (newFile) {
                updatedFileUrl = `${req.protocol}://${req.get("host")}/${newFile.path.replace(/\\/g, "/")}`;
                updatedExternalUrl = null;
                updatedFileType = getFileTypeFromMimetype(newFile.mimetype);

                if (existing.file_url) {
                    try {
                        const oldUrl = new URL(existing.file_url);
                        const oldFilePath = decodeURIComponent(oldUrl.pathname.substring(1));

                        if (fs.existsSync(oldFilePath)) {
                            fs.unlinkSync(oldFilePath);
                        }
                    } catch (error) {
                        console.log("Old material file delete failed:", error.message);
                    }
                }
            }

            const updateQuery = `
                UPDATE course_material_files
                SET
                    file_url = ?,
                    external_url = ?,
                    file_type = ?
                WHERE id = ?
            `;

            db.query(
                updateQuery,
                [
                    updatedFileUrl,
                    updatedExternalUrl,
                    updatedFileType,
                    fileId
                ],
                (updateErr) => {
                    if (updateErr) {
                        return res.status(500).json({
                            success: false,
                            message: "File update failed",
                            error: updateErr.message
                        });
                    }

                    return res.status(200).json({
                        success: true,
                        message: "File updated successfully"
                    });
                }
            );
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Update material file failed",
            error: error.message
        });
    }
};

// DELETE SINGLE FILE RECORD
const deleteMaterialFile = (req, res) => {
    try {
        const userId = req.user.id;
        const fileId = req.params.fileId;

        const getQuery = `
            SELECT f.*, tp.user_id
            FROM course_material_files f
            JOIN course_materials cm ON f.course_material_id = cm.id
            JOIN courses c ON cm.course_id = c.id
            JOIN trainer_profiles tp ON c.trainer_profile_id = tp.id
            WHERE f.id = ?
            LIMIT 1
        `;

        db.query(getQuery, [fileId], (err, result) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "File fetch failed",
                    error: err.message
                });
            }

            if (result.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "File not found"
                });
            }

            const existing = result[0];

            if (Number(existing.user_id) !== Number(userId)) {
                return res.status(403).json({
                    success: false,
                    message: "You are not allowed to delete this file"
                });
            }

            if (existing.file_url) {
                try {
                    const oldUrl = new URL(existing.file_url);
                    const oldFilePath = decodeURIComponent(oldUrl.pathname.substring(1));

                    if (fs.existsSync(oldFilePath)) {
                        fs.unlinkSync(oldFilePath);
                    }
                } catch (error) {
                    console.log("Material file delete failed:", error.message);
                }
            }

            db.query(`DELETE FROM course_material_files WHERE id = ?`, [fileId], (deleteErr) => {
                if (deleteErr) {
                    return res.status(500).json({
                        success: false,
                        message: "File delete failed",
                        error: deleteErr.message
                    });
                }

                return res.status(200).json({
                    success: true,
                    message: "File deleted successfully"
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Delete material file failed",
            error: error.message
        });
    }
};

module.exports = {
    addMaterialFiles,
    getMaterialFiles,
    updateMaterialFile,
    deleteMaterialFile
};