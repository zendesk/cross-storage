var connect     = require('connect');
var serveStatic = require('serve-static');

connect().use(serveStatic(__dirname + '/..')).listen(process.env.ZUUL_PORT);
