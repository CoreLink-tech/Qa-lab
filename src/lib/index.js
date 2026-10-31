"use strict";

/**
 * Public library surface for QA Lab scanner.
 * Usage from workers / other packages:
 *   const { scan } = require('qa-lab/src/lib');
 *   // or after packaging: require('qa-lab/lib')
 */

const { scan, scoreToGrade } = require("./scan");

module.exports = {
  scan,
  scoreToGrade,
};
