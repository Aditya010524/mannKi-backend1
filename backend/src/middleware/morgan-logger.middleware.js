import morgan from 'morgan';
import chalk from 'chalk';

// define custom format
morgan.format('colored', (tokens, req, res) => {
  const status = Number(tokens.status(req, res));
  const method = tokens.method(req, res);
  const url = tokens.url(req, res);
  const responseTime = tokens['response-time'](req, res);

  // 🎨 Color logic for response time
  // Green: < 50ms (fast) - 0.05 seconds
  // Yellow: < 200 (okay) - 0.2 seconds
  // Red: > 500ms (slow)  - 0.5 seconds

  let timeColor;
  const time = parseFloat(responseTime).toFixed(3);
  if (responseTime < 50) {
    timeColor = chalk.green(`${time} ms`);
  } else if (responseTime < 200) {
    timeColor = chalk.yellow(`${time} ms`);
  } else {
    timeColor = chalk.red(`${time} ms`);
  }

  // 🎨 colors
  const statusColor =
    status >= 500
      ? chalk.bgRed.white.bold(status)
      : status >= 400
        ? chalk.yellow.bold(status)
        : status >= 300
          ? chalk.cyan.bold(status)
          : chalk.green.bold(status);

  return [
    chalk.cyan(new Date().toLocaleTimeString('en-US')), // 12hr time only
    chalk.yellow.bold(method), // HTTP method
    chalk.magenta(url), // Endpoint
    statusColor, // Status code
    timeColor, // Response time
  ].join(' ');
});

// export middleware
const morganLogger = morgan('colored');

export default morganLogger;
