const nodemailer = require("nodemailer");
const { sequelize } = require("../../config/db"); // Import the existing MySQL connection
const { QueryTypes } = require("sequelize");

// Function to send email
async function createMail(
  mailModule,
  action,
  name,
  mobile,
  admin_email,
  date_of_joining,
  role,
  profile_url,
  designation,
  password,
  toArr
) {
  

  try {
    // Fetch email template
    const [emailRows] = await sequelize.query("SELECT * FROM emails WHERE module = ? AND action = ? AND status = 1", {
      replacements: [mailModule, action],
      type: QueryTypes.SELECT,
    });
    if (emailRows.length === 0) throw new Error("Email template not found");
    const email = emailRows;  // Assign the first (and only) element to email

    // Fetch SMTP credentials
    const [smtpRows] = await sequelize.query("SELECT * FROM smtp_credentials WHERE module = ? AND action = ? AND status = '1'", {
      replacements: [mailModule, action],
      type: QueryTypes.SELECT,
    });
    if (smtpRows.length === 0) throw new Error("SMTP credentials not found");
    const smtp = smtpRows;  // Assign the first (and only) element to smtp

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure, // true for 465, false for other ports
      auth: {
        user: smtp.username,
        pass: smtp.password,
      },
    });

    let profile_picture_tr = "";
    if (profile_url) {
      profile_url = profile_url.replace(/\\/g, "/");
      profile_picture_tr = `<tr>
        <td><strong>Profile</strong></td>
        <td><img src="${profile_url}" alt="Profile Picture"></td>
    </tr>`;
    }

    // Replace placeholders in the email template
    let template = email.template
      .replace(/{{role}}/g, role)
      .replace(/{{profile_picture_tr}}/g, profile_picture_tr)
      .replace(/{{name}}/g, name)
      .replace(/{{mobile}}/g, mobile)
      .replace(/{{email}}/g, admin_email)
      .replace(/{{date_of_joining}}/g, date_of_joining)
      .replace(/{{name}}/g, name)
      .replace(/{{designation}}/g, designation)
      .replace(/{{password}}/g, password);

    // Prepare recipient list based on whether the branch is a head branch
    let recipientList = toArr.map(
      (customer) => `"${customer.name}" <${customer.email}>`
    );
    console.log(`recipientList - `, recipientList);

    // Send email to the prepared recipient list
    const info = await transporter.sendMail({
      from: `"${smtp.title}" <${smtp.username}>`,
      to: recipientList.join(", "), // Join the recipient list into a string
      subject: email.title,
      html: template,
    });

    console.log("Email sent successfully:", info.response);
  } catch (error) {
    console.error("Error sending email:", error.message);
  } finally {
    
  }
}

module.exports = { createMail };
