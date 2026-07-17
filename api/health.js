module.exports = function healthHandler(req, res) {
  res.status(200).json({
    ok: true,
    commit: process.env.VERCEL_GIT_COMMIT_SHA || 'local'
  });
};
