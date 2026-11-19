
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    const userRole = String(req.user.role || "").toLowerCase();

    const normalizedRoles = allowedRoles.map(role =>
      role.toLowerCase()
    );

    if (!normalizedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to perform this action"
      });
    }

    next();
  };
};

module.exports = authorizeRoles;

