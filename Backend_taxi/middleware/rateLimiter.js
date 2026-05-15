const store = new Map();

const createLimiter = ({ windowMs = 60000, max = 20, message = 'Trop de tentatives. Réessayez plus tard.' } = {}) => {
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    let record = store.get(key);

    if (!record || now > record.resetAt) {
      record = { count: 0, resetAt: now + windowMs };
    }

    record.count++;
    store.set(key, record);

    if (record.count > max) {
      return res.status(429).json({ message });
    }

    next();
  };
};

// Nettoyage des entrées expirées toutes les 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of store.entries()) {
    if (now > val.resetAt) store.delete(key);
  }
}, 300_000);

module.exports = { createLimiter };
