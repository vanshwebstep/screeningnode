const tatDelay = require("../../models/admin/tatDelayModel");
const Common = require("../../models/admin/commonModel");
const AdminCommon = require("../../models/admin/commonModel");
const { getClientIpAddress } = require("../../utils/ipAddress");

// Controller to list all tatDelays
exports.list = (req, res) => {
  const { admin_id, _token } = req.query;

  let missingFields = [];
  if (!admin_id || admin_id === "") missingFields.push("Admin ID");
  if (!_token || _token === "") missingFields.push("Token");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }
  const action = "tat_reminder";
  Common.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: result.message, // Return the message from the authorization function
      });
    }
    Common.isAdminTokenValid(_token, admin_id, (err, result) => {
      if (err) {
        console.error("Error checking token validity:", err);
        return res.status(500).json(err);
      }

      if (!result.status) {
        return res.status(401).json({ status: false, message: result.message });
      }

      const newToken = result.newToken;

      tatDelay.list((err, result) => {
        if (err) {
          console.error("Database error:", err);
          return res
            .status(500)
            .json({ status: false, message: err.message, token: newToken });
        }

        return res.json({
          status: true,
          message: "Delay TATs fetched successfully",
          tatDelays: result,
          totalResults: result.length,
          token: newToken,
        });
      });
    });
  });
};

exports.listWithoutAuth = (req, res) => {
  const { YWRtaW5faWQ } = req.query;

  // Decode the Base64 string
  const decoded_admin_id = Buffer.from(YWRtaW5faWQ, "base64").toString("utf8");

  // Convert the decoded value to a number
  const admin_id_number = parseFloat(decoded_admin_id);

  // Divide by 1.5
  const admin_id = admin_id_number / 1.5;

  // Check if admin_id is valid
  if (isNaN(admin_id) || !admin_id) {
    return res.status(400).json({
      status: false,
      message: "Please provide a valid admin id",
    });
  }

  let missingFields = [];
  if (!admin_id || admin_id === "") missingFields.push("Admin ID");

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `Missing required fields: ${missingFields.join(", ")}`,
    });
  }

  const action = "tat_reminder";
  Common.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: result.message, // Return the message from the authorization function
      });
    }

    tatDelay.list((err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({
          status: false,
          message: err.message,
        });
      }

      res.json({
        status: true,
        message: "Delay TATs fetched successfully",
        tatDelays: result,
        totalResults: result.length,
      });
    });
  });
};

exports.delete = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const { customer_id, admin_id, _token } = req.query;

  // Validate required fields
  const requiredFields = { customer_id, admin_id, _token };
  const missingFields = Object.keys(requiredFields)
    .filter((field) => !requiredFields[field])
    .map((field) => field.replace(/_/g, " "));

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `The following required fields are missing: ${missingFields.join(
        ", "
      )}.`,
    });
  }

  // Check branch authorization
  const action = "tat_reminder";
  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: `Authorization failed: ${result.message}`,
      });
    }

    // Verify admin token
    AdminCommon.isAdminTokenValid(_token, admin_id, (err, result) => {
      if (err) {
        console.error("Error verifying admin token:", err);
        return res.status(500).json({
          status: false,
          message:
            "An error occurred while verifying the admin token. Please try again later.",
        });
      }

      if (!result.status) {
        return res.status(401).json({
          status: false,
          message: `Token validation failed: ${result.message}`,
        });
      }

      const newToken = result.newToken;

      // Delete the customer from the TAT delay list
      tatDelay.delete(customer_id, (err, result) => {
        if (err) {
          console.error(
            "Database error during deletion from the TAT delay list:",
            err
          );
          AdminCommon.adminActivityLog(
            ipAddress,
            ipType,
            admin_id,
            "TAT Delay",
            "Delete",
            "0",
            JSON.stringify({ customer_id }),
            err.message,
            () => {}
          );
          return res.status(500).json({
            status: false,
            message:
              "An error occurred while removing the customer from the TAT delay list. Please try again.",
            token: newToken,
          });
        }

        // Log successful deletion
        AdminCommon.adminActivityLog(
          ipAddress,
          ipType,
          admin_id,
          "TAT Delay",
          "Delete",
          "1",
          JSON.stringify({ customer_id }),
          null,
          () => {}
        );

        return res.status(200).json({
          status: true,
          message:
            "All applications linked to this customer have been removed. New TAT will apply for any future applications.",
          token: newToken,
        });
      });
    });
  });
};

exports.deleteApplication = (req, res) => {
  const { ipAddress, ipType } = getClientIpAddress(req);

  const { application_id, customer_id, admin_id, _token } = req.query;

  // Validate required fields
  const requiredFields = { application_id, customer_id, admin_id, _token };
  const missingFields = Object.keys(requiredFields)
    .filter((field) => !requiredFields[field])
    .map((field) => field.replace(/_/g, " "));

  if (missingFields.length > 0) {
    return res.status(400).json({
      status: false,
      message: `The following required fields are missing: ${missingFields.join(
        ", "
      )}.`,
    });
  }

  // Check branch authorization
  const action = "tat_reminder";
  AdminCommon.isAdminAuthorizedForAction(admin_id, action, (result) => {
    if (!result.status) {
      return res.status(403).json({
        status: false,
        message: `Authorization failed: ${result.message}`,
      });
    }

    // Verify admin token
    AdminCommon.isAdminTokenValid(_token, admin_id, (err, result) => {
      if (err) {
        console.error("Error verifying admin token:", err);
        return res.status(500).json({
          status: false,
          message:
            "An error occurred while verifying the admin token. Please try again later.",
        });
      }

      if (!result.status) {
        return res.status(401).json({
          status: false,
          message: `Token validation failed: ${result.message}`,
        });
      }

      const newToken = result.newToken;

      // Delete the customer from the TAT delay list
      tatDelay.deleteApplication(application_id, customer_id, (err, result) => {
        if (err) {
          console.error(
            "Database error during deletion from the TAT delay list:",
            err
          );
          AdminCommon.adminActivityLog(
            ipAddress,
            ipType,
            admin_id,
            "TAT Delay",
            "Delete",
            "0",
            JSON.stringify({ customer_id }),
            err.message,
            () => {}
          );
          return res.status(500).json({
            status: false,
            message:
              "An error occurred while removing the customer from the TAT delay list. Please try again.",
            token: newToken,
          });
        }

        // Log successful deletion
        AdminCommon.adminActivityLog(
          ipAddress,
          ipType,
          admin_id,
          "TAT Delay",
          "Delete",
          "1",
          JSON.stringify({ customer_id }),
          null,
          () => {}
        );

        return res.status(200).json({
          status: true,
          message:
            "All applications linked to this customer have been removed. New TAT will apply for any future applications.",
          token: newToken,
        });
      });
    });
  });
};
