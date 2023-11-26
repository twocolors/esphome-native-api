#!/usr/bin/env node

const Discovery = require('../lib/discovery.js');
Discovery().then(results => {
    console.log(results);
});