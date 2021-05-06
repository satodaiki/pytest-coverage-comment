// get onlu actual lines with coverage from coverage-file
const generateBadgeLink = (percentage) => {
  // https://shields.io/category/coverage
  const rangeColors = [
    {
      color: 'red',
      range: [0, 40],
    },
    {
      color: 'orange',
      range: [40, 60],
    },
    {
      color: 'yellow',
      range: [60, 80],
    },
    {
      color: 'green',
      range: [80, 90],
    },
    {
      color: 'brightgreen',
      range: [90, 101],
    },
  ];

  const num = parseFloat(percentage);

  const { color } =
    rangeColors.find(({ range: [min, max] }) => num >= min && num < max) ||
    rangeColors[0];

  return color;
};

// get actual lines from coverage-file
const getActualLines = (data) => {
  if (!data || !data.length) {
    return null;
  }

  console.log(`Parsing coverage file`);
  const lines = data.split('\n');
  const startIndex = lines.findIndex((l) => l.includes('coverage: platform'));
  const endIndex = lines.findIndex((l) => l.includes('TOTAL '));
  if (startIndex === -1) {
    return null;
  }

  return lines.slice(startIndex + 3, endIndex - 1);
};

// get total line from coverage-file
const getTotal = (data) => {
  if (!data || !data.length) {
    return null;
  }

  const lines = data.split('\n');
  const line = lines.find((l) => l.includes('TOTAL '));

  return parseOneLine(line);
};

// parse one line from coverage-file
const parseOneLine = (line) => {
  if (!line) {
    return null;
  }

  const parsedLine = line.split('   ').filter((l) => l);

  if (parsedLine.length < 4) {
    return null;
  }

  return {
    name: parsedLine[0],
    stmts: parsedLine[1].trimStart(),
    miss: parsedLine[2].trimStart(),
    cover: parsedLine[3].trimStart(),
    missing: parsedLine[4] && parsedLine[4].split(', '),
  };
};

// parse coverage-file
const parse = (data) => {
  const actualLines = getActualLines(data);

  if (!actualLines) {
    return null;
  }

  return actualLines.map(parseOneLine);
};

// collapse all lines to folders structure
const makeFolders = (coverage, options) => {
  const folders = {};

  for (const line of coverage) {
    const parts = line.name.replace(options.prefix, '').split('/');
    const folder = parts.slice(0, -1).join('/');

    folders[folder] = folders[folder] || [];
    folders[folder].push(line);
  }

  return folders;
};

// gets summary line
const getSummaryLine = (data) => {
  const total = getTotal(data);

  return `Founded ${total.cover} coverage`;
};

// convert all data to html output
const toHtml = (data, options) => {
  const { badgeTitle, title } = options;
  const table = toTable(data, options);
  const total = getTotal(data);
  const color = generateBadgeLink(total.cover);
  const totalLine = `<img alt="${badgeTitle}" src="https://img.shields.io/badge/${badgeTitle}-${total.cover}25-${color}.svg" />`;

  return `${totalLine}<br/><details><summary>${title}</summary>${table}</details>`;
};

// make html table from coverage-file
const toTable = (data, options) => {
  const coverage = parse(data);
  if (!coverage) {
    console.log(`Coverage file not well formed`);
    return null;
  }
  const totalLine = getTotal(data);
  options.hasMissing = coverage.some((c) => c.missing);

  console.log(`Generating coverage report`);
  const headTr = toHeadRow(options);

  const totalTr = toTotalRow(totalLine);

  const folders = makeFolders(coverage, options);

  const rows = Object.keys(folders)
    .sort()
    .reduce(
      (acc, key) => [
        ...acc,
        toFolderTd(key),
        ...folders[key].map((file) => toRow(file, key !== '', options)),
      ],
      []
    );

  return `<table>${headTr}<tbody>${rows.join('')}${totalTr}</tbody></table>`;
};

// make html head row - th
const toHeadRow = (options) => {
  const lastTd = options.hasMissing ? '<th>Missing</th>' : '';

  return `<tr><th>File</th><th>Stmts</th><th>Miss</th><th>Cover</th>${lastTd}</tr>`;
};

// make html row - tr
const toRow = (item, indent = false, options) => {
  const { stmts, miss, cover } = item;

  const name = toFileNameTd(item, indent, options);
  const missing = toMissingTd(item, options);
  const lastTd = options.hasMissing ? `<td>${missing}</td>` : '';

  return `<tr><td>${name}</td><td>${stmts}</td><td>${miss}</td><td>${cover}</td>${lastTd}</tr>`;
};

// make summary row - tr
const toTotalRow = (item) => {
  const { name, stmts, miss, cover } = item;

  return `<tr><td><b>${name}</b></td><td><b>${stmts}</b></td><td><b>${miss}</b></td><td><b>${cover}</b></td><td>&nbsp;</td></tr>`;
};

// make fileName cell - td
const toFileNameTd = (item, indent = false, options) => {
  const relative = item.name.replace(options.prefix, '');
  const href = `https://github.com/${options.repository}/blob/${options.commit}/${relative}`;
  const parts = relative.split('/');
  const last = parts[parts.length - 1];
  const space = indent ? '&nbsp; &nbsp;' : '';

  return `${space}<a href="${href}">${last}</a>`;
};

// make folder row - tr
const toFolderTd = (path) => {
  if (path === '') {
    return '';
  }

  return `<tr><td colspan="5"><b>${path}</b></td></tr>`;
};

// make missing cell - td
const toMissingTd = (item, options) => {
  if (!item.missing) {
    return '&nbsp;';
  }

  return item.missing
    .map((range) => {
      const [start, end = start] = range.split('-');
      const fragment = start === end ? `L${start}` : `L${start}-L${end}`;
      const relative = item.name;
      const href = `https://github.com/${options.repository}/blob/${options.commit}/${relative}#${fragment}`;
      const text = start === end ? start : `${start}&ndash;${end}`;

      return `<a href="${href}">${text}</a>`;
    })
    .join(', ');
};

module.exports = { toHtml, getSummaryLine };