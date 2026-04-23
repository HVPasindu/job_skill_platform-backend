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
createFolderIfNotExists("uploads/company-logos");
createFolderIfNotExists("uploads/course-thumbnails");

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === "profile_image") {
            cb(null, "uploads/profile-images");
        } else if (file.fieldname === "resumes" || file.fieldname === "resume") {
            cb(null, "uploads/resumes");
        } else if (file.fieldname === "company_logo") {
            cb(null, "uploads/company-logos");
        } else if (file.fieldname === "thumbnail") {
            cb(null, "uploads/course-thumbnails");
        } else {
            cb(new Error("Invalid field name"), null);
        }
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueName + path.extname(file.originalname));
    }
});

const imageTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp"
];

const fileFilter = (req, file, cb) => {
    if (
        file.fieldname === "profile_image" ||
        file.fieldname === "company_logo" ||
        file.fieldname === "thumbnail"
    ) {
        if (imageTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Only JPG, JPEG, PNG, WEBP files are allowed"), false);
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
const uploadCompanyLogo = upload.single("company_logo");
const uploadCourseThumbnail = upload.single("thumbnail");

module.exports = {
    uploadProfileImage,
    uploadResumes,
    uploadSingleResume,
    uploadCompanyLogo,
    uploadCourseThumbnail
};