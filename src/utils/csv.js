function escapeCsv(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replaceAll('"', '""') + '"';
  }
  return str;
}

function toCsvRow(obj, columns) {
  return columns.map(col => escapeCsv(obj[col])).join(',');
}

function generateCsv(data, columns) {
  const header = columns.join(',');
  const rows = data.map(row => toCsvRow(row, columns));
  return header + '\n' + rows.join('\n');
}

function sendCsv(res, csv, filename) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

module.exports = { escapeCsv, toCsvRow, generateCsv, sendCsv };
