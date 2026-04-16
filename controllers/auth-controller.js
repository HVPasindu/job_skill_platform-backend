const bcrypt = require("bcrypt");
const db = require("../db/db-connection");
const sendOtpEmail = require("../services/send-email");
const jwt = require('jsonwebtoken');

function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// SIGNUP
const signup = async (req, res) => {
    try {
        const { full_name, email, password, confirmPassword, role_name } = req.body;

        if (!full_name || !email || !password || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "All fields are required",
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: "Passwords do not match",
            });
        }

        const allowedRoles = ["job_seeker", "employer", "trainer"];

        if (!allowedRoles.includes(role_name)) {
            return res.status(400).json({
                success: false,
                message: "Invalid role selected"
            });
        }

        const checkUserQuery = "SELECT * FROM users WHERE email = ?";
        db.query(checkUserQuery, [email], async (checkError, checkResult) => {
            if (checkError) {
                return res.status(500).json({
                    success: false,
                    message: "Database error",
                    error: checkError.message,
                });
            }

            if (checkResult.length > 0) {
                const existingUser = checkResult[0];

                if (existingUser.is_email_verified) {
                    return res.status(400).json({
                        success: false,
                        message: "Email already registered and verified",
                    });
                } else {
                    // 👉 UNVERIFIED USER FLOW

                    const hashedPassword = await bcrypt.hash(password, 10);

                    // update user details
                    const updateUserQuery = `
                                                UPDATE users
                                                SET full_name = ?, password_hash = ?
                                                WHERE id = ?
                                            `;

                    db.query(
                        updateUserQuery,
                        [full_name, hashedPassword, existingUser.id],
                        async (updateError) => {
                            if (updateError) {
                                return res.status(500).json({
                                    success: false,
                                    message: "User update failed",
                                    error: updateError.message,
                                });
                            }

                            const otp = generateOtp();
                            const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

                            const updateOtpQuery = `
                                                    UPDATE email_verifications
                                                    SET otp_code = ?, expires_at = ?, attempts_count = 0, is_verified = false, verified_at = NULL
                                                    WHERE user_id = ?
                                                `;

                            db.query(
                                updateOtpQuery,
                                [otp, expiresAt, existingUser.id],
                                async (otpError) => {
                                    if (otpError) {
                                        return res.status(500).json({
                                            success: false,
                                            message: "OTP update failed",
                                            error: otpError.message,
                                        });
                                    }

                                    await sendOtpEmail(email, otp);

                                    return res.status(200).json({
                                        success: true,
                                        message: "Account updated. New OTP sent.",
                                    });
                                }
                            );
                        }
                    );

                    return;
                }
            }

            const hashedPassword = await bcrypt.hash(password, 10);

            const insertUserQuery = `
                                    INSERT INTO users (full_name, email, password_hash, is_email_verified, is_active)
                                    VALUES (?, ?, ?, false, true)
                                    `;

            db.query(
                insertUserQuery,
                [full_name, email, hashedPassword],
                (insertUserError, insertUserResult) => {
                    if (insertUserError) {
                        return res.status(500).json({
                            success: false,
                            message: "User insert failed",
                            error: insertUserError.message,
                        });
                    }

                    const userId = insertUserResult.insertId;

                    //const getRoleQuery = "SELECT id FROM roles WHERE role_name = 'job_seeker'";
                    const getRoleQuery = "SELECT id FROM roles WHERE role_name = ?";
                    
                    db.query(getRoleQuery,[role_name], (roleError, roleResult) => {
                        if (roleError || roleResult.length === 0) {
                            return res.status(500).json({
                                success: false,
                                message: "Job seeker role not found",
                            });
                        }

                        const roleId = roleResult[0].id;

                        const insertUserRoleQuery = `
                                                    INSERT INTO user_roles (user_id, role_id)
                                                    VALUES (?, ?)
                                                    `;

                        db.query(
                            insertUserRoleQuery,
                            [userId, roleId],
                            async (userRoleError) => {
                                if (userRoleError) {
                                    return res.status(500).json({
                                        success: false,
                                        message: "User role insert failed",
                                        error: userRoleError.message,
                                    });
                                }

                                const otp = generateOtp();
                                const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

                                const insertOtpQuery = `
                                                        INSERT INTO email_verifications (user_id, email, otp_code, expires_at, is_verified, attempts_count)
                                                        VALUES (?, ?, ?, ?, false, 0)
                                                        `;

                                db.query(
                                    insertOtpQuery,
                                    [userId, email, otp, expiresAt],
                                    async (otpError) => {
                                        if (otpError) {
                                            return res.status(500).json({
                                                success: false,
                                                message: "OTP save failed",
                                                error: otpError.message,
                                            });
                                        }

                                        try {
                                            await sendOtpEmail(email, otp);

                                            return res.status(201).json({
                                                success: true,
                                                message: "Signup successful. OTP sent to email.",
                                                user_id: userId,
                                            });
                                        } catch (emailError) {
                                            return res.status(500).json({
                                                success: false,
                                                message: "OTP email send failed",
                                                error: emailError.message,
                                            });
                                        }
                                    }
                                );
                            }
                        );
                    });
                }
            );
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Signup failed",
            error: error.message,
        });
    }
};

// VERIFY OTP
const verifyOtp = (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: "Email and OTP are required",
            });
        }

        const getOtpQuery = `
      SELECT * FROM email_verifications
      WHERE email = ? AND otp_code = ? AND is_verified = false
      ORDER BY id DESC
      LIMIT 1
    `;

        db.query(getOtpQuery, [email, otp], (otpError, otpResult) => {
            if (otpError) {
                return res.status(500).json({
                    success: false,
                    message: "Database error",
                    error: otpError.message,
                });
            }

            if (otpResult.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid OTP",
                });
            }

            const otpData = otpResult[0];
            const now = new Date();
            const expiry = new Date(otpData.expires_at);

            if (now > expiry) {
                return res.status(400).json({
                    success: false,
                    message: "OTP expired",
                });
            }

            const updateOtpQuery = `
        UPDATE email_verifications
        SET is_verified = true, verified_at = NOW()
        WHERE id = ?
      `;

            db.query(updateOtpQuery, [otpData.id], (updateOtpError) => {
                if (updateOtpError) {
                    return res.status(500).json({
                        success: false,
                        message: "OTP update failed",
                        error: updateOtpError.message,
                    });
                }

                const updateUserQuery = `
          UPDATE users
          SET is_email_verified = true
          WHERE id = ?
        `;

                db.query(updateUserQuery, [otpData.user_id], (updateUserError) => {
                    if (updateUserError) {
                        return res.status(500).json({
                            success: false,
                            message: "User verification update failed",
                            error: updateUserError.message,
                        });
                    }

                    return res.status(200).json({
                        success: true,
                        message: "Email verified successfully",
                    });
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "OTP verification failed",
            error: error.message,
        });
    }
};

// RESEND OTP
const resendOtp = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required",
            });
        }

        const getUserQuery = "SELECT * FROM users WHERE email = ?";
        db.query(getUserQuery, [email], async (userError, userResult) => {
            if (userError) {
                return res.status(500).json({
                    success: false,
                    message: "Database error",
                    error: userError.message,
                });
            }

            if (userResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "User not found",
                });
            }

            const user = userResult[0];

            if (user.is_email_verified) {
                return res.status(400).json({
                    success: false,
                    message: "Email already verified",
                });
            }

            const otp = generateOtp();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

            const updateOtpQuery = `
        UPDATE email_verifications
        SET otp_code = ?, expires_at = ?, attempts_count = 0, is_verified = false, verified_at = NULL
        WHERE user_id = ? AND is_verified = false
      `;

            db.query(updateOtpQuery, [otp, expiresAt, user.id], async (otpError) => {
                if (otpError) {
                    return res.status(500).json({
                        success: false,
                        message: "OTP update failed",
                        error: otpError.message,
                    });
                }

                try {
                    await sendOtpEmail(email, otp);

                    return res.status(200).json({
                        success: true,
                        message: "OTP resent successfully",
                    });
                } catch (emailError) {
                    return res.status(500).json({
                        success: false,
                        message: "Resend OTP email failed",
                        error: emailError.message,
                    });
                }
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Resend OTP failed",
            error: error.message,
        });
    }
};

// LOGIN
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required",
            });
        }

        const getUserQuery = "SELECT * FROM users WHERE email = ?";

        db.query(getUserQuery, [email], async (userError, userResult) => {
            if (userError) {
                return res.status(500).json({
                    success: false,
                    message: "Database error",
                    error: userError.message,
                });
            }

            if (userResult.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: "User not found",
                });
            }

            const user = userResult[0];

            const getUserRolesQuery = `
                SELECT r.role_name
                FROM user_roles ur
                JOIN roles r ON ur.role_id = r.id
                WHERE ur.user_id = ?
            `;

            db.query(getUserRolesQuery, [user.id], async (roleError, roleResults) => {
                if (roleError) {
                    return res.status(500).json({
                        success: false,
                        message: "Roles fetch failed",
                        error: roleError.message,
                    });
                }

                if (!user.is_email_verified) {
                    return res.status(403).json({
                        success: false,
                        message: "Please verify your email before login",
                    });
                }

                // if (!user.is_active) {
                //     return res.status(403).json({
                //         success: false,
                //         message: "Your account is inactive",
                //     });
                // }

                const isPasswordCorrect = await bcrypt.compare(password, user.password_hash);

                if (!isPasswordCorrect) {
                    return res.status(400).json({
                        success: false,
                        message: "Invalid password",
                    });
                }

                const rolesArray = roleResults.map((item) => item.role_name);

                const token = jwt.sign(
                    {
                        id: user.id,
                        email: user.email,
                        roles: rolesArray
                    },
                    process.env.JWT_SECRET,
                    {
                        expiresIn: process.env.JWT_EXPIRES_IN || "1d"
                    }
                );

                return res.status(200).json({
                    success: true,
                    message: "Login successful",
                    token,
                    user: {
                        id: user.id,
                        full_name: user.full_name,
                        email: user.email,
                        roles: rolesArray
                    },
                });
            });
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Login failed",
            error: error.message,
        });
    }
};
module.exports = {
    signup,
    verifyOtp,
    resendOtp,
    login,
};