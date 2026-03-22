const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Resend } = require("resend");

const {
  getUserByEmail,
  createUser,
  updateUser,
  updateUserPasswordByEmail,
} = require("../models/user.model");

const {
  invalidatePreviousCodes,
  createResetCode,
  getActiveResetCode,
  markResetCodeUsed,
  incrementResetAttempts,
} = require("../models/password_reset.model");

const JWT_SECRET = process.env.JWT_SECRET;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;
const RESET_CODE_EXPIRES_MINUTES = Number(
  process.env.RESET_CODE_EXPIRES_MINUTES || 10,
);

const resend = new Resend(RESEND_API_KEY);

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function generateSixDigitCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function getResetCopy(locale, code) {
  const map = {
    tr: {
      subject: "Şifre sıfırlama kodunuz",
      title: "Şifre sıfırlama isteği",
      text: `Kodunuz: ${code}. Bu kod ${RESET_CODE_EXPIRES_MINUTES} dakika geçerlidir.`,
      footer:
        "Eğer bu işlemi siz yapmadıysanız, bu e-postayı yok sayabilirsiniz.",
    },
    en: {
      subject: "Your password reset code",
      title: "Password reset request",
      text: `Your code is: ${code}. This code is valid for ${RESET_CODE_EXPIRES_MINUTES} minutes.`,
      footer: "If you did not request this, you can safely ignore this email.",
    },
    ru: {
      subject: "Код для сброса пароля",
      title: "Запрос на сброс пароля",
      text: `Ваш код: ${code}. Код действителен ${RESET_CODE_EXPIRES_MINUTES} минут.`,
      footer: "Если это были не вы, просто проигнорируйте это письмо.",
    },
    kz: {
      subject: "Құпиясөзді қалпына келтіру коды",
      title: "Құпиясөзді қалпына келтіру сұрауы",
      text: `Сіздің кодыңыз: ${code}. Код ${RESET_CODE_EXPIRES_MINUTES} минут жарамды.`,
      footer:
        "Егер бұл сұрауды сіз жасамаған болсаңыз, бұл хатты елемей-ақ қойыңыз.",
    },
  };

  return map[locale] || map.en;
}

function buildResetEmailHtml(copy, code) {
  return `
    <div style="margin:0;padding:0;background:#f4f8fc;font-family:Arial,sans-serif;">
      <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
        <div style="background:#ffffff;border-radius:24px;padding:32px;border:1px solid rgba(15,23,42,0.08);">
          <div style="display:inline-block;padding:8px 14px;border-radius:999px;background:rgba(41,130,218,0.10);color:#2982da;font-weight:700;font-size:13px;margin-bottom:18px;">
            BioNum
          </div>

          <h1 style="margin:0 0 12px 0;color:#0F172A;font-size:28px;line-height:1.2;">
            ${copy.title}
          </h1>

          <p style="margin:0 0 20px 0;color:#64748B;font-size:15px;line-height:1.6;">
            ${copy.text}
          </p>

          <div style="margin:24px 0;padding:18px 20px;border-radius:18px;background:#f8fbff;border:1px solid rgba(41,130,218,0.14);text-align:center;">
            <div style="font-size:34px;letter-spacing:10px;font-weight:800;color:#0F172A;">
              ${code}
            </div>
          </div>

          <p style="margin:0;color:#94A3B8;font-size:13px;line-height:1.6;">
            ${copy.footer}
          </p>
        </div>
      </div>
    </div>
  `;
}

// --- Регистрация
exports.register = async (req, res) => {
  try {
    const {
      first_name,
      middle_name,
      last_name,
      date_of_birth,
      email,
      password,
    } = req.body;

    if (!first_name || !last_name || !email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const normalizedEmail = normalizeEmail(email);

    const existingUser = await getUserByEmail(normalizedEmail);
    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await createUser({
      first_name,
      middle_name,
      last_name,
      date_of_birth,
      email: normalizedEmail,
      password: hashedPassword,
    });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(201).json({ message: "User registered", token, user });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// --- Логин
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Почта и пароль обязательны" });
    }

    const normalizedEmail = normalizeEmail(email);

    const user = await getUserByEmail(normalizedEmail);
    if (!user) {
      return res
        .status(400)
        .json({ error: "Не правильные данные пользователя" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Неверный пароль" });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({ message: "Успешный вход", token, user });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// --- Обновление данных пользователя
exports.update = async (req, res) => {
  try {
    const userId = req.user.id;

    const {
      first_name,
      middle_name,
      last_name,
      date_of_birth,
      email,
      password,
    } = req.body;

    const updatedData = {
      first_name,
      middle_name,
      last_name,
      date_of_birth,
      email: email ? normalizeEmail(email) : undefined,
    };

    if (password) {
      updatedData.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await updateUser(userId, updatedData);

    res.json({ message: "User updated", user: updatedUser });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// --- Проверка токена
exports.verifyToken = async (req, res) => {
  try {
    const user = req.user;
    res.json({ valid: true, user });
  } catch (error) {
    res.status(401).json({ valid: false, error: "Invalid token" });
  }
};

// --- Отправка reset-кода
exports.sendResetCode = async (req, res) => {
  try {
    const { email, locale = "en" } = req.body;
    console.log("Received reset code request for email:", email, "locale:", locale);

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await getUserByEmail(normalizedEmail);

    // Для безопасности можно не палить, есть ли email в системе.
    if (!user) {
      return res.json({
        success: true,
        message: "If this email exists, a reset code has been sent.",
      });
    }

    const code = generateSixDigitCode();
    const expiresAt = new Date(
      Date.now() + RESET_CODE_EXPIRES_MINUTES * 60 * 1000,
    );

    await invalidatePreviousCodes(normalizedEmail);
    await createResetCode({
      email: normalizedEmail,
      code,
      expires_at: expiresAt,
    });

    const copy = getResetCopy(locale, code);

    await resend.emails.send({
      from: RESEND_FROM_EMAIL,
      to: normalizedEmail,
      subject: copy.subject,
      html: buildResetEmailHtml(copy, code),
      replyTo: RESEND_FROM_EMAIL,
    });

    console.log("Reset code sent to:", normalizedEmail);

    return res.json({
      success: true,
      message: "If this email exists, a reset code has been sent.",
    });
  } catch (error) {
    console.error("Error sending reset code:", error);
    res.status(500).json({ error: "Failed to send reset code" });
  }
};

// --- Проверка reset-кода
exports.verifyResetCode = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ error: "Email and code are required" });
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedCode = String(code).replace(/\D/g, "").slice(0, 6);

    if (normalizedCode.length !== 6) {
      return res.status(400).json({ error: "Code must be 6 digits" });
    }

    const resetEntry = await getActiveResetCode(
      normalizedEmail,
      normalizedCode,
    );

    if (!resetEntry) {
      return res.status(400).json({ error: "Invalid code" });
    }

    if (new Date(resetEntry.expires_at) < new Date()) {
      return res.status(400).json({ error: "Code expired" });
    }

    if (resetEntry.attempts >= 5) {
      return res.status(429).json({ error: "Too many attempts" });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("Error verifying reset code:", error);
    res.status(500).json({ error: "Failed to verify code" });
  }
};

// --- Сброс пароля
exports.resetPassword = async (req, res) => {
  try {
    const { email, code, password } = req.body;

    if (!email || !code || !password) {
      return res
        .status(400)
        .json({ error: "Email, code and password are required" });
    }

    if (String(password).length < 6) {
      return res
        .status(400)
        .json({ error: "Password must be at least 6 characters" });
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedCode = String(code).replace(/\D/g, "").slice(0, 6);

    const user = await getUserByEmail(normalizedEmail);
    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    const resetEntry = await getActiveResetCode(
      normalizedEmail,
      normalizedCode,
    );

    if (!resetEntry) {
      return res.status(400).json({ error: "Invalid code" });
    }

    if (new Date(resetEntry.expires_at) < new Date()) {
      return res.status(400).json({ error: "Code expired" });
    }

    if (resetEntry.attempts >= 5) {
      return res.status(429).json({ error: "Too many attempts" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const updatedUser = await updateUserPasswordByEmail(
      normalizedEmail,
      hashedPassword,
    );

    await markResetCodeUsed(resetEntry.id);

    const token = jwt.sign(
      { id: updatedUser.id, email: updatedUser.email },
      JWT_SECRET,
      { expiresIn: "7d" },
    );

    return res.json({
      success: true,
      message: "Password reset successful",
      token,
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({ error: "Failed to reset password" });
  }
};
