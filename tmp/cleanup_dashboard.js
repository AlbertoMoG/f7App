const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

const predictionsStart = code.indexOf('  const predictions = React.useMemo(() => {');
const predictionsEndMarker = '}, [matches, stats, allPlayerRatings, scheduledMatches, totalGoals, totalGoalsAgainst, standings]);\n';
const predictionsEnd = code.indexOf(predictionsEndMarker, predictionsStart) + predictionsEndMarker.length;

if (predictionsStart !== -1) {
  code = code.substring(0, predictionsStart) + code.substring(predictionsEnd);
}

const uiMarkerStart = '      {/* Upcoming Matches */}';
const uiStartIndex = code.indexOf(uiMarkerStart);

const uiMarkerEnd = 'function Label';
let uiEndIndex = code.indexOf(uiMarkerEnd);
uiEndIndex = code.lastIndexOf('    </div>', uiEndIndex);

if (uiStartIndex !== -1) {
  code = code.substring(0, uiStartIndex) + '\n' + code.substring(uiEndIndex);
}

fs.writeFileSync('src/components/Dashboard.tsx', code);
