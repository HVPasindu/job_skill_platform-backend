const multer = require("multer");
const path = require("path");
const fs = require("fs");

const createFolderIfNotExists = (folderPath) => {
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
    }
};

createFolderIfNotExists("uploads/profile-images");
createFolderIfNotExists("uploads/resumes");

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === "profile_image") {
            cb(null, "uploads/profile-images");
        } else if (file.fieldname === "resumes" || file.fieldname === "resume") {
            cb(null, "uploads/resumes");
        } else {
            cb(new Error("Invalid field name"), null);
        }
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueName + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    if (file.fieldname === "profile_image") {
        const allowedTypes = [
            "image/jpeg",
            "image/jpg",
            "image/png",
            "image/webp"
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Only JPG, JPEG, PNG, WEBP files are allowed for profile image"), false);
        }
    } else if (file.fieldname === "resumes" || file.fieldname === "resume") {
        const allowedTypes = [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "image/jpeg",
            "image/jpg",
            "image/png"
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Only PDF, DOC, DOCX, JPG, JPEG, PNG files are allowed for resumes"), false);
        }
    } else {
        cb(new Error("Invalid file field"), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

const uploadProfileImage = upload.single("profile_image");
const uploadResumes = upload.array("resumes", 5);
const uploadSingleResume = upload.single("resume");

module.exports = {
    uploadProfileImage,
    uploadResumes,
    uploadSingleResume
};