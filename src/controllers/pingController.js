/**
 * Tiny public endpoint for learning the request path.
 * No auth. No database.
 */
export function ping(_req, res) {
  res.json({
    success: true,
    message: 'pong',
    time: new Date().toISOString(),
  });
}
