import * as xlsx from 'xlsx';
import fs from 'fs';

const atdBuf = fs.readFileSync('atd.csv');
const atdWB = xlsx.read(atdBuf, { type: 'buffer' });
const atdSheet = atdWB.Sheets[atdWB.SheetNames[0]];
const atdData = xlsx.utils.sheet_to_json(atdSheet);
console.log('atd.csv rows:', atdData.length);

const emcBuf = fs.readFileSync('emc.csv');
const emcWB = xlsx.read(emcBuf, { type: 'buffer' });
const emcSheet = emcWB.Sheets[emcWB.SheetNames[0]];
const emcData = xlsx.utils.sheet_to_json(emcSheet);
console.log('emc.csv rows:', emcData.length);
console.log('Total samples in atd + emc:', atdData.length + emcData.length);
