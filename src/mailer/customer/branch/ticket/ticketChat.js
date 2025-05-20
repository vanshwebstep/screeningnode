const nodemailer = require("nodemailer");
const { sequelize } = require("../../../../config/db"); // Import the existing MySQL connection
const { QueryTypes } = require("sequelize");

// Function to send email
async function ticketChat(
  mailModule,
  action,
  branch_name,
  customer_name,
  ticket_number,
  title,
  description,
  message,
  reply_date,
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

    // Replace placeholders in the email template
    let template = email.template
      .replace(/{{branch_name}}/g, branch_name)
      .replace(/{{customer_name}}/g, customer_name)
      .replace(/{{ticket_number}}/g, ticket_number)
      .replace(/{{title}}/g, title)
      .replace(/{{description}}/g, description)
      .replace(/{{replied_by}}/g, "branch")
      .replace(/{{reply_message}}/g, message)
      .replace(/{{reply_date}}/g, reply_date);

    // Prepare recipient list based on whether the branch is a head branch
    const recipientList = toArr.map(
      (customer) => `"${customer.name}" <${customer.email}>`
    );

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

module.exports = { ticketChat };
