const { sequelize } = require("../../config/db");
const { QueryTypes } = require("sequelize"); const moment = require("moment"); // Ensure you have moment.js installed

const tatDelay = {
  index: async (callback) => {
    // SQL query to retrieve applications, customers, branches, tat_days, and admin details
    const SQL = `
                SELECT 
                    logs.admin_id,
                    admins.name AS admin_name,
                    admins.profile_picture,
                    admins.email AS admin_email,
                    admins.mobile AS admin_mobile,
                    admins.emp_id,
                    -- First login time
                    MIN(logs.created_at) AS first_login_time,
                    -- Last logout time
                    MAX(logs.created_at) AS last_logout_time,
                    -- First login time
                    MIN(logs.created_at) AS created_at
                FROM admin_login_logs AS logs
                INNER JOIN admins ON logs.admin_id = admins.id
                WHERE logs.action IN ('login')
                GROUP BY logs.admin_id, DATE(logs.created_at)
                ORDER BY logs.admin_id, DATE(logs.created_at) DESC;
    `;
    const applicationResults = await sequelize.query(SQL, {
      type: QueryTypes.SELECT,
    });

    if (applicationResults.length === 0) {
      return callback(null, { message: "No records found" });
    }
    // Return the processed data
    return callback(null, applicationResults);

  },

  /*
  attendanceIndex: async (callback) => {
    try {
      // Step 1: Fetch all admins
      const admins = await sequelize.query(`
        SELECT id AS admin_id, name AS admin_name, profile_picture, email AS admin_email, mobile AS admin_mobile, emp_id
        FROM admins
      `, {
        type: QueryTypes.SELECT,
      });

      // Step 2: Fetch all check-ins/outs
      const attendanceRecords = await sequelize.query(`
        SELECT 
          cio.admin_id,
          cio.status,
          cio.created_at,
          DATE(cio.created_at) AS record_date,
          (
            SELECT MIN(logs.created_at)
            FROM admin_login_logs AS logs
            WHERE logs.admin_id = cio.admin_id 
              AND logs.action = 'login'
              AND DATE(logs.created_at) = DATE(cio.created_at)
          ) AS first_login_time
        FROM check_in_outs AS cio
        ORDER BY DATE(cio.created_at) DESC
      `, {
        type: QueryTypes.SELECT,
      });

      // Step 3: Fetch break data
      const breaks = await sequelize.query(`
        SELECT b.*
        FROM admin_breaks b
        INNER JOIN (
          SELECT admin_id, type, DATE(created_at) AS record_date, MAX(id) AS max_id
          FROM admin_breaks
          GROUP BY admin_id, type, DATE(created_at)
        ) latest
        ON b.id = latest.max_id
      `, {
        type: QueryTypes.SELECT,
      });

      // Step 4: Group all attendance and breaks
      const grouped = {};

      for (const record of attendanceRecords) {
        const date = record.record_date;
        const adminId = record.admin_id;

        if (!grouped[date]) grouped[date] = {};
        if (!grouped[date][adminId]) {
          grouped[date][adminId] = {
            date,
            admin_id: adminId,
            first_check_in_time: null,
            last_check_out_time: null,
            check_in_outs: [],
            breaks: [],
            first_login_time: record.first_login_time,
          };
        }

        const entry = grouped[date][adminId];

        const isCheckIn = record.status === 'check-in';
        const isCheckOut = record.status === 'check-out';

        if (isCheckIn) {
          if (!entry.first_check_in_time || new Date(record.created_at) < new Date(entry.first_check_in_time)) {
            entry.first_check_in_time = record.created_at;
          }
        }

        if (isCheckOut) {
          if (!entry.last_check_out_time || new Date(record.created_at) > new Date(entry.last_check_out_time)) {
            entry.last_check_out_time = record.created_at;
          }
        }

        entry.check_in_outs.push({
          status: record.status,
          time: record.created_at,
        });
      }

      for (const brk of breaks) {
        const date = brk.created_at.toISOString().split("T")[0];
        const adminId = brk.admin_id;

        if (!grouped[date]) grouped[date] = {};
        if (!grouped[date][adminId]) {
          grouped[date][adminId] = {
            date,
            admin_id: adminId,
            first_check_in_time: null,
            last_check_out_time: null,
            check_in_outs: [],
            breaks: [],
            first_login_time: null,
          };
        }

        grouped[date][adminId].breaks.push({
          type: brk.type,
          time: brk.created_at,
        });
      }

      // Step 5: Final result: ensure all admins exist even if no attendance or break
      const result = [];

      const allDates = Object.keys(grouped);
      for (const admin of admins) {
        for (const date of allDates) {
          const base = grouped[date][admin.admin_id] || {
            date,
            admin_id: admin.admin_id,
            first_check_in_time: null,
            last_check_out_time: null,
            check_in_outs: [],
            breaks: [],
            first_login_time: null,
          };

          result.push({
            ...base,
            admin_name: admin.admin_name,
            profile_picture: admin.profile_picture,
            admin_email: admin.admin_email,
            admin_mobile: admin.admin_mobile,
            emp_id: admin.emp_id,
          });
        }
      }

      // Optional: sort result by date descending
      result.sort((a, b) => new Date(b.date) - new Date(a.date));
      const filteredResult = result.filter(item => item.check_in_outs.length > 0 || item.breaks.length > 0);
      return callback(null, filteredResult);

      // return callback(null, result);
    } catch (error) {
      console.error("Error in index:", error);
      return callback(error, null);
    }
  },
  */

  attendanceIndex: async (callback) => {
    try {
      const breakTableName = "admin_breaks";
      const adminLoginLogsTableName = "admin_login_logs";
  
      // Step 1: Fetch all admins
      const admins = await sequelize.query(`
        SELECT id AS admin_id, name AS admin_name, profile_picture, email AS admin_email, mobile AS admin_mobile, emp_id
        FROM admins
      `, {
        type: QueryTypes.SELECT,
      });
  
      const finalResult = [];
  
      // Step 2: Fetch all distinct dates from admin_login_logs
      const distinctDatesResult = await sequelize.query(`
        SELECT DISTINCT DATE(created_at) AS date
        FROM ${adminLoginLogsTableName}
        ORDER BY date DESC
      `, {
        type: QueryTypes.SELECT,
      });
  
      const distinctDates = distinctDatesResult.map(row => row.date);
  
      // Step 3: Fetch all distinct break types
      const distinctTypesResult = await sequelize.query(`
        SELECT DISTINCT type
        FROM ${breakTableName}
      `, {
        type: QueryTypes.SELECT,
      });
  
      const distinctBreakTypes = distinctTypesResult.map(row => row.type);
  
      // Step 4: Loop through each admin and date
      for (const admin of admins) {
        for (const date of distinctDates) {
  
          // 4.1 Fetch first login time for that admin and date
          const [firstLoginResult] = await sequelize.query(`
            SELECT created_at AS first_login_time
            FROM ${adminLoginLogsTableName}
            WHERE admin_id = ? AND action = 'login' AND DATE(created_at) = ?
            ORDER BY id ASC
            LIMIT 1
          `, {
            replacements: [admin.admin_id, date],
            type: QueryTypes.SELECT,
          });

          const [lastLogoutResult] = await sequelize.query(`
            SELECT created_at AS last_logout_time
            FROM ${adminLoginLogsTableName}
            WHERE admin_id = ? AND action = 'logout' AND DATE(created_at) = ?
            ORDER BY id DESC
            LIMIT 1
          `, {
            replacements: [admin.admin_id, date],
            type: QueryTypes.SELECT,
          });
  
          const first_login_time = firstLoginResult ? firstLoginResult.first_login_time : null;
          const last_logout_time = lastLogoutResult ? lastLogoutResult.last_logout_time : null;
  
          // 4.2 Fetch first break time for each type for that admin and date
          const breakTimes = {};
          for (const type of distinctBreakTypes) {
            const [breakResult] = await sequelize.query(`
              SELECT created_at
              FROM ${breakTableName}
              WHERE admin_id = ? AND type = ? AND DATE(created_at) = ?
              ORDER BY id ASC
              LIMIT 1
            `, {
              replacements: [admin.admin_id, type, date],
              type: QueryTypes.SELECT,
            });
  
            breakTimes[type] = breakResult ? breakResult.created_at : null;
          }
  
          finalResult.push({
            date,
            admin_id: admin.admin_id,
            admin_name: admin.admin_name,
            profile_picture: admin.profile_picture,
            admin_email: admin.admin_email,
            admin_mobile: admin.admin_mobile,
            emp_id: admin.emp_id,
            first_login_time,
            last_logout_time,
            break_times: breakTimes,
          });
        }
      }
  
      // Optional: sort by latest date first
      finalResult.sort((a, b) => new Date(b.date) - new Date(a.date));
  
      return callback(null, finalResult);
  
    } catch (error) {
      console.error("Error in attendanceIndex:", error);
      return callback(error, null);
    }
  },

  activityList: async (logDate, adminId, callback) => {

    const query = `SELECT * FROM \`admin_activity_logs\` WHERE \`admin_id\` = ? AND DATE(created_at) = ?;`;

    console.log("Database connection established successfully.");
    const results = await sequelize.query(query, {
      replacements: [adminId, logDate],
      type: QueryTypes.SELECT,
    });
    callback(null, results);
  }

};

// Helper function to handle query errors and release connection
function handleQueryError(err, connection, callback) {
  console.error("Query error:", err);

  callback(err, null);
}

module.exports = tatDelay;
