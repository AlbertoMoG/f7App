const fs = require('fs');

const code = fs.readFileSync('src/components/AIAnalysis.tsx', 'utf8');

const newSquadAnalysis = `
  const squadAnalysis = React.useMemo(() => {
    const teamAvgBaremo = allPlayerRatings.reduce((a, b) => a + b.rating, 0) / (allPlayerRatings.length || 1);
    const allMatchesWithScores = matches
      .filter(m => m.scoreTeam != null && m.scoreOpponent != null)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const result = new Map<string, {
      score: number,
      grade: string,
      reasons: { type: 'positive' | 'negative' | 'neutral', text: string }[],
      attendingCount: number,
      playerContributions: { player: Player, rating: number, tags: string[] }[],
      improvements: { player: Player, scoreIncrease: number, reasons: { type: 'positive' | 'negative' | 'neutral', text: string }[] }[]
    }>();

    const evaluateSquad = (squadPlayers: Player[], matchContext: Match | null = null, baseEvalMode: boolean = false) => {
      const matchDate = matchContext ? new Date(matchContext.date) : new Date();
      // Baremo histórico hasta antes del partido
      const historicalMatches = matchContext ? matches.filter(m => new Date(m.date) < matchDate) : matches;

      const squadSize = squadPlayers.length;
      let totalScore = 50;
      const reasons: { type: 'positive' | 'negative' | 'neutral', text: string }[] = [];

      if (squadSize === 0) return { score: 0, grade: 'F', reasons };

      const ratings = squadPlayers.map(p => {
        if (matchContext) {
           const breakdown = calculatePlayerRating(historicalMatches, injuries, stats, p, globalSeasonId);
           return breakdown.notaFinal || 0;
        } else {
           const ratingData = allPlayerRatings.find(r => r.id === p.id);
           return ratingData?.rating || 0;
        }
      });
      const currentAvgBaremo = ratings.reduce((a, b) => a + b, 0) / squadSize;
      
      const squadRatio = currentAvgBaremo / (teamAvgBaremo || 1);
      const diff = (squadRatio - 1) * 100;
      totalScore += diff * 1.5;

      if (diff > 5) reasons.push({ type: 'positive', text: \`Nivel técnico superior (+\${diff.toFixed(0)}% de la media)\` });
      else if (diff < -5) reasons.push({ type: 'negative', text: \`Nivel técnico inferior (\${diff.toFixed(0)}%)\` });

      const hasGoalkeeper = squadPlayers.some(p => p.position === 'Portero');
      const defendersCount = squadPlayers.filter(p => p.position === 'Defensa').length;
      const attackersCount = squadPlayers.filter(p => p.position === 'Delantero').length;

      if (!hasGoalkeeper) {
        totalScore -= 15;
        reasons.push({ type: 'negative', text: 'Sin portero especialista' });
      } else {
        totalScore += 5;
        reasons.push({ type: 'positive', text: 'Portería cubierta' });
      }

      if (defendersCount < 2 && squadSize >= 7) {
        totalScore -= 10;
        reasons.push({ type: 'negative', text: 'Pocos defensas en la convocatoria' });
      } else if (defendersCount >= 3) {
        totalScore += 5;
        reasons.push({ type: 'positive', text: 'Sólida base defensiva' });
      }

      if (attackersCount >= 3) {
        totalScore += 5;
        reasons.push({ type: 'positive', text: 'Alta presencia ofensiva' });
      }

      const calculateAge = (birthDate: string) => {
        if (!birthDate) return 25;
        const birth = new Date(birthDate);
        let age = matchDate.getFullYear() - birth.getFullYear();
        if (matchDate.getMonth() < birth.getMonth() || (matchDate.getMonth() === birth.getMonth() && matchDate.getDate() < birth.getDate())) {
          age--;
        }
        return age;
      };

      const ages = squadPlayers.map(p => calculateAge(p.birthDate!));
      const avgAge = ages.reduce((a, b) => a + b, 0) / (ages.length || 1);
      
      if (avgAge < 22) {
        totalScore -= 2;
        reasons.push({ type: 'neutral', text: \`Plantilla muy joven (\${avgAge.toFixed(1)} años)\` });
      } else if (avgAge >= 22 && avgAge < 26) {
        totalScore += 5;
        reasons.push({ type: 'positive', text: \`Media de edad ideal (\${avgAge.toFixed(1)} años)\` });
      } else if (avgAge >= 26 && avgAge < 32) {
        totalScore += 8;
        reasons.push({ type: 'positive', text: \`Punto de madurez deportivo (\${avgAge.toFixed(1)} años)\` });
      } else {
        totalScore -= 5;
        reasons.push({ type: 'negative', text: \`Alta veteranía media (\${avgAge.toFixed(1)} años)\` });
      }

      const youngCount = ages.filter(a => a < 25).length;
      const veteranCount = ages.filter(a => a >= 30).length;
      if (youngCount >= 2 && veteranCount >= 2) {
        totalScore += 5;
        reasons.push({ type: 'positive', text: 'Equilibrio juventud/veteranía' });
      }

      let synergiesFound = 0;
      for (let i = 0; i < squadPlayers.length; i++) {
        for (let j = i + 1; j < squadPlayers.length; j++) {
          const p1 = squadPlayers[i];
          const p2 = squadPlayers[j];
          const matchesTogether = historicalMatches.filter(m => 
            stats.some(s => s.matchId === m.id && s.playerId === p1.id && s.attendance === 'attending') &&
            stats.some(s => s.matchId === m.id && s.playerId === p2.id && s.attendance === 'attending')
          );
          if (matchesTogether.length >= 3) {
            const winsTogether = matchesTogether.filter(m => (m.scoreTeam || 0) > (m.scoreOpponent || 0)).length;
            if (winsTogether / matchesTogether.length >= 0.70) synergiesFound++;
          }
        }
      }
      if (synergiesFound > 0) {
        totalScore += synergiesFound * 3;
        reasons.push({ type: 'positive', text: \`Química letal: \${synergiesFound} dúos probados históricamente\` });
      }

      if (squadSize >= 10) {
        totalScore += 15;
        reasons.push({ type: 'positive', text: \`Convocatoria ideal (\${squadSize} jug.), rotaciones completas\` });
      } else if (squadSize === 9) {
        totalScore += 8;
        reasons.push({ type: 'positive', text: \`Buena profundidad (9 jug., 2 cambios)\` });
      } else if (squadSize === 8) {
        totalScore -= 5;
        reasons.push({ type: 'neutral', text: \`Profundidad justa (8 jug., 1 cambio)\` });
      } else if (squadSize === 7) {
        if (avgAge >= 30) {
           totalScore -= 25;
           reasons.push({ type: 'negative', text: \`Al límite (7 jug.) y muy veteranos (\${avgAge.toFixed(1)} años), fatiga crítica\` });
        } else if (avgAge <= 24) {
           totalScore -= 10;
           reasons.push({ type: 'negative', text: \`Al límite (7 jug.), amortiguado por ser plantilla jóven (\${avgAge.toFixed(1)} años)\` });
        } else {
           totalScore -= 15;
           reasons.push({ type: 'negative', text: \`Plantilla al límite (7 jug., sin cambios), alto riesgo físico\` });
        }
      } else if (squadSize < 7) {
        if (avgAge >= 30) {
           totalScore -= 50;
           reasons.push({ type: 'negative', text: \`Inferioridad (\${squadSize} jug.) agravada fuertemente por veteranía (\${avgAge.toFixed(1)} años)\` });
        } else if (avgAge <= 24) {
           totalScore -= 30;
           reasons.push({ type: 'negative', text: \`Inferioridad (\${squadSize} jug.) mitigada levemente por juventud\` });
        } else {
           totalScore -= 40;
           reasons.push({ type: 'negative', text: \`Plantilla en inferioridad manifiesta (\${squadSize} jug.)\` });
        }
      }

      totalScore = Math.max(0, Math.min(100, Math.round(totalScore)));

      let grade = 'C';
      if (totalScore >= 85) grade = 'S';
      else if (totalScore >= 75) grade = 'A';
      else if (totalScore >= 60) grade = 'B';
      else if (totalScore >= 45) grade = 'C';
      else grade = 'D';

      return { score: totalScore, grade, reasons };
    };

    filteredMatches.forEach(match => {
      const matchStats = stats.filter(s => s.matchId === match.id);
      const attendingIds = matchStats.filter(s => s.attendance === 'attending').map(s => s.playerId);
      const currentAttendingPlayers = players.filter(p => attendingIds.includes(p.id));
      const currentSquadSize = currentAttendingPlayers.length;

      if (currentSquadSize < 5) return;

      const baseEval = evaluateSquad(currentAttendingPlayers, match, true);

      // Usar baremo histórico para las contribuciones
      const matchDate = new Date(match.date);
      const historicalMatches = matches.filter(m => new Date(m.date) < matchDate);

      const playerContributions = currentAttendingPlayers.map(p => {
        const ratingData = calculatePlayerRating(historicalMatches, injuries, stats, p, globalSeasonId);
        const pRating = ratingData.notaFinal || 0;
        const tags: string[] = [p.position];

        if (p.position === 'Portero') tags.push('Solidez en portería');
        else if (pRating > teamAvgBaremo + 2) tags.push('Estrella técnica');
        else if (pRating > teamAvgBaremo) tags.push('Aporta calidad media');
        
        return { player: p, rating: pRating, tags };
      }).sort((a, b) => b.rating - a.rating);

      const eligiblePlayers = players.filter(p => 
        p.isActive !== false &&
        playerSeasons.some(ps => ps.seasonId === match.seasonId && ps.playerId === p.id) &&
        !injuries.some(i => i.playerId === p.id && !i.endDate)
      );

      const missingPlayers = eligiblePlayers.filter(p => !attendingIds.includes(p.id));
      
      const improvements = missingPlayers.map(p => {
        const simEval = evaluateSquad([...currentAttendingPlayers, p], match);
        const newReasons = simEval.reasons.filter(r => !baseEval.reasons.some(br => br.text === r.text));
        
        if (simEval.score > baseEval.score && newReasons.length === 0) {
            newReasons.push({ type: 'positive', text: \`Eleva la media táctica o técnica\` });
        }

        return {
           player: p,
           scoreIncrease: simEval.score - baseEval.score,
           reasons: newReasons
        };
      }).filter(s => s.scoreIncrease > 0)
        .sort((a, b) => b.scoreIncrease - a.scoreIncrease)
        .slice(0, 3);

      result.set(match.id, {
        score: baseEval.score,
        grade: baseEval.grade,
        reasons: baseEval.reasons,
        attendingCount: currentSquadSize,
        playerContributions,
        improvements
      });
    });

    return result;
  }, [filteredMatches, allPlayerRatings, stats, players, matches, playerSeasons, injuries, globalSeasonId]);
`;

const startIndex = code.indexOf('  const squadAnalysis = React.useMemo(() => {');
const endIndexStr = '  }, [filteredMatches, allPlayerRatings, stats, players, matches]);\n';
const endIndexStrBackup = '  }, [filteredMatches, allPlayerRatings, stats, players, matches, playerSeasons, injuries]);\n';

let endIndex = -1;
if (code.indexOf(endIndexStr) !== -1) {
  endIndex = code.indexOf(endIndexStr) + endIndexStr.length;
} else if (code.indexOf(endIndexStrBackup) !== -1) {
  endIndex = code.indexOf(endIndexStrBackup) + endIndexStrBackup.length;
}

if (startIndex !== -1 && endIndex !== -1) {
    let newCode = code.substring(0, startIndex) + newSquadAnalysis + code.substring(endIndex);
    fs.writeFileSync('src/components/AIAnalysis.tsx', newCode);
    console.log("Success");
} else {
    console.log("Could not find boundaries");
}
