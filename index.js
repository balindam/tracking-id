const mysql = require('mysql');
const crypto = require('crypto');
const util = require('util');

// Database connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// Promisify the query function for use with async/await
db.query = util.promisify(db.query);

// Generate a 22 character hash
function generateHash() {
  return crypto.randomBytes(11).toString('hex');
}

let lastIndex = 0;

exports.handler = async (event, context) => {
  const user = event.queryStringParameters.pubid;
  const ip = event.requestContext.identity.sourceIp;
  
  const allowedPubIds = process.env.ALLOWED_PUBIDS.split(',');

  if (!allowedPubIds.includes(user)) {
    return {
      statusCode: 400,
      body: 'Invalid Publisher ID.',
    };
  }
  
  let hash;
  
  try {
    // Check if IP already exists in the database
    const checkIpQuery = "SELECT * FROM `offer_process_nfl` WHERE `ip` = ?";
    const ipExists = await db.query(checkIpQuery, [ip]);

    if (ipExists.length > 0) {
      // IP exists, update timestamp
      const updateQuery = "UPDATE `offer_process_nfl` SET `date` = NOW() WHERE `ip` = ?";
      await db.query(updateQuery, [ip]);
      hash = ipExists[0].hash;
    } else {
      // IP does not exist, insert new record
      hash = generateHash();
      const insertQuery = "INSERT INTO `offer_process_nfl`(`hash`, `date`, `pubid`, `ip`, `status`) VALUES (?, NOW(), ?, ?, 0)";
      await db.query(insertQuery, [hash, user, ip]);
    }

    console.log('Values:', [hash, user, ip]);
  } catch (err) {
    console.error('Database query error:', err);
    throw err;
  }
  
  const redirect_links = [
    `https://sportsnlivehd.com/live-football.php?lang=en&promo=stream&flow=trial?subid=${user}&t1=${hash}`,
    `https://sportsnlive.net/live-football.php?lang=en&promo=stream&flow=trial?subid=${user}&t1=${hash}`,
    `https://sportsnlivehd.org/live-football.php?lang=en&promo=stream&flow=trial?subid=${user}&t1=${hash}`,
    `https://sportslivehd.co/live-football.php?lang=en&promo=stream&flow=trial?subid=${user}&t1=${hash}`
  ];
  
  // Get the next redirect link and update lastIndex
  const redirect_link = redirect_links[lastIndex];
  lastIndex = (lastIndex + 1) % redirect_links.length;

  return {
    statusCode: 302,
    headers: {
      Location: redirect_link,
    },
  };
};