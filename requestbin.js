const request = require('request')

function requestBin (details, done) {
  const options = {
    method: 'POST',
    url: process.env.binUrl,
    body: {
      message: 'Details for the question',
      details: details
    },
    json: true
  }
  request(options, function (err, res, body) {
    done(err, res, body)
  })
}

module.exports = requestBin
