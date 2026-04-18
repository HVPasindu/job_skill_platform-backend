const db = require("../db/db-connection");
const fs = require("fs");
const { sendCompanyAddedEmail } = require("../services/send-email");

const createCompany = (req, res) => {
    try {
        const userId = req.user.id;

        const {
            company_name,
            company_email,
            company_phone,
            website_url,
            industry,
            company_size,
            description,
            address_line,
            city,
            country,
            job_title,
            department,
            bio
        } = req.body;

        const companyLogoUrl = req.file
            ? `${req.protocol}://${req.get("host")}/${req.file.path.replace(/\\/g, "/")}`
            : null;

        if (!company_name) {
            return res.status(400).json({
                success: false,
                message: "Company name is required"
            });
        }

        const checkEmployerRoleQuery = `
            SELECT r.id
            FROM user_roles ur
            JOIN roles r ON ur.role_id = r.id
            WHERE ur.user_id = ? AND r.role_name = 'employer'
            LIMIT 1
        `;

        db.query(checkEmployerRoleQuery, [userId], (roleCheckError, roleCheckResult) => {
            if (roleCheckError) {
                return res.status(500).json({
                    success: false,
                    message: "Employer role check failed",
                    error: roleCheckError.message
                });
            }

            if (roleCheckResult.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: "Only employer users can create a company"
                });
            }

            const checkCompanyExistsQuery = `
                SELECT *
                FROM companies
                WHERE LOWER(company_name) = LOWER(?)
                   OR (company_email IS NOT NULL AND company_email = ?)
                   OR (website_url IS NOT NULL AND website_url = ?)
                LIMIT 1
            `;

            db.query(
                checkCompanyExistsQuery,
                [company_name, company_email || null, website_url || null],
                (existsError, existsResult) => {
                    if (existsError) {
                        return res.status(500).json({
                            success: false,
                            message: "Company check failed",
                            error: existsError.message
                        });
                    }

                    if (existsResult.length > 0) {
                        return res.status(400).json({
                            success: false,
                            message: "Company already exists"
                        });
                    }

                    const insertCompanyQuery = `
                        INSERT INTO companies (
                            company_name,
                            company_email,
                            company_phone,
                            website_url,
                            logo_url,
                            industry,
                            company_size,
                            description,
                            address_line,
                            city,
                            country
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;

                    db.query(
                        insertCompanyQuery,
                        [
                            company_name,
                            company_email || null,
                            company_phone || null,
                            website_url || null,
                            companyLogoUrl,
                            industry || null,
                            company_size || null,
                            description || null,
                            address_line || null,
                            city || null,
                            country || null
                        ],
                        (insertCompanyError, insertCompanyResult) => {
                            if (insertCompanyError) {
                                return res.status(500).json({
                                    success: false,
                                    message: "Company creation failed",
                                    error: insertCompanyError.message
                                });
                            }

                            const companyId = insertCompanyResult.insertId;

                            const insertCompanyUserQuery = `
                                INSERT INTO company_users (
                                    company_id,
                                    user_id,
                                    company_role,
                                    is_primary_contact,
                                    job_title,
                                    department,
                                    bio
                                )
                                VALUES (?, ?, ?, ?, ?, ?, ?)
                            `;

                            db.query(
                                insertCompanyUserQuery,
                                [
                                    companyId,
                                    userId,
                                    "owner",
                                    true,
                                    job_title || null,
                                    department || null,
                                    bio || null
                                ],
                                (companyUserError) => {
                                    if (companyUserError) {
                                        return res.status(500).json({
                                            success: false,
                                            message: "Company user creation failed",
                                            error: companyUserError.message
                                        });
                                    }

                                    return res.status(201).json({
                                        success: true,
                                        message: "Company created successfully",
                                        company_id: companyId,
                                        logo_url: companyLogoUrl
                                    });
                                }
                            );
                        }
                    );
                }
            );
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Create company failed",
            error: error.message
        });
    }
};

const getMyCompanies = (req, res) => {
    try {
        const userId = req.user.id;

        const getMyCompaniesQuery = `
            SELECT
                c.id,
                c.company_name,
                c.company_email,
                c.company_phone,
                c.website_url,
                c.logo_url,
                c.industry,
                c.company_size,
                c.description,
                c.address_line,
                c.city,
                c.country,
                c.created_at,
                c.updated_at,
                cu.id AS company_user_id,
                cu.company_role,
                cu.is_primary_contact,
                cu.job_title,
                cu.department,
                cu.bio
            FROM company_users cu
            JOIN companies c ON cu.company_id = c.id
            WHERE cu.user_id = ?
            ORDER BY cu.is_primary_contact DESC, c.id DESC
        `;

        db.query(getMyCompaniesQuery, [userId], (error, result) => {
            if (error) {
                return res.status(500).json({
                    success: false,
                    message: "Fetch companies failed",
                    error: error.message
                });
            }

            return res.status(200).json({
                success: true,
                companies: result
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Get companies failed",
            error: error.message
        });
    }
};

const getSingleCompany = (req, res) => {
    try {
        const userId = req.user.id;
        const companyId = req.params.id;

        const getSingleCompanyQuery = `
            SELECT
                c.id,
                c.company_name,
                c.company_email,
                c.company_phone,
                c.website_url,
                c.logo_url,
                c.industry,
                c.company_size,
                c.description,
                c.address_line,
                c.city,
                c.country,
                c.created_at,
                c.updated_at,
                cu.id AS company_user_id,
                cu.company_role,
                cu.is_primary_contact,
                cu.job_title,
                cu.department,
                cu.bio
            FROM company_users cu
            JOIN companies c ON cu.company_id = c.id
            WHERE cu.user_id = ? AND cu.company_id = ?
            LIMIT 1
        `;

        db.query(getSingleCompanyQuery, [userId, companyId], (error, result) => {
            if (error) {
                return res.status(500).json({
                    success: false,
                    message: "Fetch company failed",
                    error: error.message
                });
            }

            if (result.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Company not found"
                });
            }

            return res.status(200).json({
                success: true,
                company: result[0]
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Get company failed",
            error: error.message
        });
    }
};

const updateCompany = (req, res) => {
    try {
        const userId = req.user.id;
        const companyId = req.params.id;

        const {
            company_name,
            company_email,
            company_phone,
            website_url,
            industry,
            company_size,
            description,
            address_line,
            city,
            country
        } = req.body;

        const checkAccessQuery = `
            SELECT * FROM company_users
            WHERE company_id = ? AND user_id = ?
        `;

        db.query(checkAccessQuery, [companyId, userId], (checkError, checkResult) => {
            if (checkError) {
                return res.status(500).json({
                    success: false,
                    message: "Database error",
                    error: checkError.message
                });
            }

            if (checkResult.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: "You are not allowed to update this company"
                });
            }

            const getCompanyQuery = `
                SELECT * FROM companies
                WHERE id = ?
            `;

            db.query(getCompanyQuery, [companyId], (companyError, companyResult) => {
                if (companyError) {
                    return res.status(500).json({
                        success: false,
                        message: "Company fetch failed",
                        error: companyError.message
                    });
                }

                if (companyResult.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Company not found"
                    });
                }

                const oldCompany = companyResult[0];
                let updatedLogoUrl = oldCompany.logo_url;

                if (req.file) {
                    updatedLogoUrl = `${req.protocol}://${req.get("host")}/${req.file.path.replace(/\\/g, "/")}`;

                    if (oldCompany.logo_url) {
                        try {
                            const oldUrl = new URL(oldCompany.logo_url);
                            const oldLogoPath = decodeURIComponent(oldUrl.pathname.substring(1));

                            if (fs.existsSync(oldLogoPath)) {
                                fs.unlinkSync(oldLogoPath);
                            }
                        } catch (error) {
                            console.log("Old company logo delete failed:", error.message);
                        }
                    }
                }

                const updateCompanyQuery = `
                    UPDATE companies
                    SET
                        company_name = ?,
                        company_email = ?,
                        company_phone = ?,
                        website_url = ?,
                        logo_url = ?,
                        industry = ?,
                        company_size = ?,
                        description = ?,
                        address_line = ?,
                        city = ?,
                        country = ?
                    WHERE id = ?
                `;

                db.query(
                    updateCompanyQuery,
                    [
                        company_name || oldCompany.company_name,
                        company_email || oldCompany.company_email,
                        company_phone || oldCompany.company_phone,
                        website_url || oldCompany.website_url,
                        updatedLogoUrl,
                        industry || oldCompany.industry,
                        company_size || oldCompany.company_size,
                        description || oldCompany.description,
                        address_line || oldCompany.address_line,
                        city || oldCompany.city,
                        country || oldCompany.country,
                        companyId
                    ],
                    (updateError) => {
                        if (updateError) {
                            return res.status(500).json({
                                success: false,
                                message: "Company update failed",
                                error: updateError.message
                            });
                        }

                        return res.status(200).json({
                            success: true,
                            message: "Company updated successfully",
                            logo_url: updatedLogoUrl
                        });
                    }
                );
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Update company failed",
            error: error.message
        });
    }
};

const addUserToCompany = (req, res) => {
    try {
        const loggedUserId = req.user.id;
        const companyId = req.params.id;

        const {
            email,
            company_role,
            is_primary_contact,
            job_title,
            department,
            bio
        } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required"
            });
        }

        const checkOwnerQuery = `
            SELECT * FROM company_users
            WHERE company_id = ? AND user_id = ? AND company_role = 'owner'
        `;

        db.query(checkOwnerQuery, [companyId, loggedUserId], (ownerError, ownerResult) => {
            if (ownerError) {
                return res.status(500).json({
                    success: false,
                    message: "Database error",
                    error: ownerError.message
                });
            }

            if (ownerResult.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: "Only owner can add users to company"
                });
            }

            const checkUserExistsQuery = `
                SELECT * FROM users
                WHERE email = ?
            `;

            db.query(checkUserExistsQuery, [email], (userError, userResult) => {
                if (userError) {
                    return res.status(500).json({
                        success: false,
                        message: "User fetch failed",
                        error: userError.message
                    });
                }

                if (userResult.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "User with this email is not registered yet"
                    });
                }

                const targetUser = userResult[0];

                const checkAlreadyAddedQuery = `
                    SELECT * FROM company_users
                    WHERE company_id = ? AND user_id = ?
                `;

                db.query(
                    checkAlreadyAddedQuery,
                    [companyId, targetUser.id],
                    (checkAddError, checkAddResult) => {
                        if (checkAddError) {
                            return res.status(500).json({
                                success: false,
                                message: "Check failed",
                                error: checkAddError.message
                            });
                        }

                        if (checkAddResult.length > 0) {
                            return res.status(400).json({
                                success: false,
                                message: "User already added to this company"
                            });
                        }

                        const insertCompanyUserQuery = `
                            INSERT INTO company_users (
                                company_id,
                                user_id,
                                company_role,
                                is_primary_contact,
                                job_title,
                                department,
                                bio
                            )
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        `;

                        db.query(
                            insertCompanyUserQuery,
                            [
                                companyId,
                                targetUser.id,
                                company_role || "employee",
                                is_primary_contact ? true : false,
                                job_title || null,
                                department || null,
                                bio || null
                            ],
                            (insertError) => {
                                if (insertError) {
                                    return res.status(500).json({
                                        success: false,
                                        message: "Add user to company failed",
                                        error: insertError.message
                                    });
                                }

                                const getEmployerRoleQuery = `
                                    SELECT id FROM roles
                                    WHERE role_name = 'employer'
                                    LIMIT 1
                                `;

                                db.query(getEmployerRoleQuery, (roleError, roleResult) => {
                                    if (roleError) {
                                        return res.status(500).json({
                                            success: false,
                                            message: "Employer role fetch failed",
                                            error: roleError.message
                                        });
                                    }

                                    if (roleResult.length === 0) {
                                        return res.status(500).json({
                                            success: false,
                                            message: "Employer role not found"
                                        });
                                    }

                                    const employerRoleId = roleResult[0].id;

                                    const checkUserRoleQuery = `
                                        SELECT * FROM user_roles
                                        WHERE user_id = ? AND role_id = ?
                                    `;

                                    db.query(checkUserRoleQuery, [targetUser.id, employerRoleId], (checkRoleError, checkRoleResult) => {
                                        if (checkRoleError) {
                                            return res.status(500).json({
                                                success: false,
                                                message: "User role check failed",
                                                error: checkRoleError.message
                                            });
                                        }

                                        const continueSendEmail = () => {
                                            const getCompanyQuery = `
                                                SELECT company_name FROM companies
                                                WHERE id = ?
                                            `;

                                            db.query(getCompanyQuery, [companyId], async (companyError, companyResult) => {
                                                const companyName =
                                                    companyResult && companyResult.length > 0
                                                        ? companyResult[0].company_name
                                                        : "Company";

                                                try {
                                                    await sendCompanyAddedEmail(
                                                        targetUser.email,
                                                        companyName,
                                                        company_role || "employee"
                                                    );
                                                } catch (emailError) {
                                                    console.log("Company add email send failed:", emailError.message);
                                                }

                                                return res.status(201).json({
                                                    success: true,
                                                    message: "User added to company successfully"
                                                });
                                            });
                                        };

                                        if (checkRoleResult.length > 0) {
                                            return continueSendEmail();
                                        }

                                        const insertUserRoleQuery = `
                                            INSERT INTO user_roles (user_id, role_id)
                                            VALUES (?, ?)
                                        `;

                                        db.query(insertUserRoleQuery, [targetUser.id, employerRoleId], (insertRoleError) => {
                                            if (insertRoleError) {
                                                return res.status(500).json({
                                                    success: false,
                                                    message: "Employer role add failed",
                                                    error: insertRoleError.message
                                                });
                                            }

                                            return continueSendEmail();
                                        });
                                    });
                                });
                            }
                        );
                    }
                );
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Add user to company failed",
            error: error.message
        });
    }
};

const getCompanyUsers = (req, res) => {
    try {
        const userId = req.user.id;
        const companyId = req.params.id;

        const checkAccessQuery = `
            SELECT * FROM company_users
            WHERE company_id = ? AND user_id = ?
        `;

        db.query(checkAccessQuery, [companyId, userId], (accessError, accessResult) => {
            if (accessError) {
                return res.status(500).json({
                    success: false,
                    message: "Access check failed",
                    error: accessError.message
                });
            }

            if (accessResult.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: "You are not allowed to view this company"
                });
            }

            const getUsersQuery = `
                SELECT
                    cu.id AS company_user_id,
                    cu.company_id,
                    cu.user_id,
                    u.full_name,
                    u.email,
                    cu.company_role,
                    cu.is_primary_contact,
                    cu.job_title,
                    cu.department,
                    cu.bio,
                    cu.created_at,
                    cu.updated_at
                FROM company_users cu
                JOIN users u ON cu.user_id = u.id
                WHERE cu.company_id = ?
                ORDER BY cu.is_primary_contact DESC, cu.id DESC
            `;

            db.query(getUsersQuery, [companyId], (error, result) => {
                if (error) {
                    return res.status(500).json({
                        success: false,
                        message: "Fetch company users failed",
                        error: error.message
                    });
                }

                return res.status(200).json({
                    success: true,
                    users: result
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Get company users failed",
            error: error.message
        });
    }
};

const updateCompanyUser = (req, res) => {
    try {
        const loggedUserId = req.user.id;
        const companyId = req.params.id;
        const companyUserId = req.params.companyUserId;

        const {
            company_role,
            is_primary_contact,
            job_title,
            department,
            bio
        } = req.body;

        const getCompanyUserQuery = `
            SELECT * FROM company_users
            WHERE id = ? AND company_id = ?
        `;

        db.query(getCompanyUserQuery, [companyUserId, companyId], (fetchError, fetchResult) => {
            if (fetchError) {
                return res.status(500).json({
                    success: false,
                    message: "Company user fetch failed",
                    error: fetchError.message
                });
            }

            if (fetchResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Company user not found"
                });
            }

            const targetUser = fetchResult[0];

            const checkOwnerQuery = `
                SELECT * FROM company_users
                WHERE company_id = ? AND user_id = ? AND company_role = 'owner'
            `;

            db.query(checkOwnerQuery, [companyId, loggedUserId], (ownerError, ownerResult) => {
                if (ownerError) {
                    return res.status(500).json({
                        success: false,
                        message: "Owner check failed",
                        error: ownerError.message
                    });
                }

                const isOwner = ownerResult.length > 0;
                const isSelf = Number(targetUser.user_id) === Number(loggedUserId);

                if (!isOwner && !isSelf) {
                    return res.status(403).json({
                        success: false,
                        message: "You can only update your own company profile"
                    });
                }

                let finalCompanyRole = targetUser.company_role;
                let finalIsPrimaryContact = targetUser.is_primary_contact;

                if (isOwner) {
                    if (!isSelf && company_role !== undefined) {
                        finalCompanyRole = company_role;
                    }

                    if (is_primary_contact !== undefined) {
                        finalIsPrimaryContact = is_primary_contact;
                    }
                }

                const finalJobTitle =
                    job_title !== undefined ? job_title : targetUser.job_title;

                const finalDepartment =
                    department !== undefined ? department : targetUser.department;

                const finalBio =
                    bio !== undefined ? bio : targetUser.bio;

                const updateCompanyUserQuery = `
                    UPDATE company_users
                    SET
                        company_role = ?,
                        is_primary_contact = ?,
                        job_title = ?,
                        department = ?,
                        bio = ?
                    WHERE id = ? AND company_id = ?
                `;

                db.query(
                    updateCompanyUserQuery,
                    [
                        finalCompanyRole,
                        finalIsPrimaryContact,
                        finalJobTitle,
                        finalDepartment,
                        finalBio,
                        companyUserId,
                        companyId
                    ],
                    (updateError) => {
                        if (updateError) {
                            return res.status(500).json({
                                success: false,
                                message: "Company user update failed",
                                error: updateError.message
                            });
                        }

                        return res.status(200).json({
                            success: true,
                            message: "Company user updated successfully"
                        });
                    }
                );
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Update company user failed",
            error: error.message
        });
    }
};

const removeCompanyUser = (req, res) => {
    try {
        const loggedUserId = req.user.id;
        const companyId = req.params.id;
        const companyUserId = req.params.companyUserId;

        const checkOwnerQuery = `
            SELECT * FROM company_users
            WHERE company_id = ? AND user_id = ? AND company_role = 'owner'
        `;

        db.query(checkOwnerQuery, [companyId, loggedUserId], (ownerError, ownerResult) => {
            if (ownerError) {
                return res.status(500).json({
                    success: false,
                    message: "Owner check failed",
                    error: ownerError.message
                });
            }

            if (ownerResult.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: "Only owner can delete users"
                });
            }

            const getTargetUserQuery = `
                SELECT * FROM company_users
                WHERE id = ? AND company_id = ?
            `;

            db.query(getTargetUserQuery, [companyUserId, companyId], (targetError, targetResult) => {
                if (targetError) {
                    return res.status(500).json({
                        success: false,
                        message: "Company user fetch failed",
                        error: targetError.message
                    });
                }

                if (targetResult.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: "Company user not found"
                    });
                }

                const targetUser = targetResult[0];

                if (targetUser.company_role === "owner") {
                    return res.status(400).json({
                        success: false,
                        message: "Owner cannot be removed"
                    });
                }

                const deleteCompanyUserQuery = `
                    DELETE FROM company_users
                    WHERE id = ? AND company_id = ?
                `;

                db.query(deleteCompanyUserQuery, [companyUserId, companyId], (deleteError, deleteResult) => {
                    if (deleteError) {
                        return res.status(500).json({
                            success: false,
                            message: "Remove company user failed",
                            error: deleteError.message
                        });
                    }

                    if (deleteResult.affectedRows === 0) {
                        return res.status(404).json({
                            success: false,
                            message: "Company user not found"
                        });
                    }

                    return res.status(200).json({
                        success: true,
                        message: "Company user removed successfully"
                    });
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Remove company user failed",
            error: error.message
        });
    }
};

module.exports = {
    createCompany,
    getMyCompanies,
    getSingleCompany,
    updateCompany,
    addUserToCompany,
    getCompanyUsers,
    updateCompanyUser,
    removeCompanyUser
};