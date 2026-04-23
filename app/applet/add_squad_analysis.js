const fs = require('fs');

const code = fs.readFileSync('src/components/AIAnalysis.tsx', 'utf8');

const squadsLogic = `

  const squadAnalysis = React.useMemo(() => {
    // Analizar todos los partidos que tienen al menos 5 jugadores confirmados
    const teamAvgBaremo = allPlayerRatings.reduce((a, b) => a + b.rating, 0) / (allPlayerRatings.length || 1);
    const allMatchesWithScores = matches
      .filter(m => m.scoreTeam != null && m.scoreOpponent != null)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const result = new Map<string, {
      score: number,
      grade: string,
      reasons: { type: 'positive' | 'negative' | 'neutral', text: string }[],
      attendingCount: number
    }>();

    filteredMatches.forEach(match => {
      const matchStats = stats.filter(s => s.matchId === match.id);
      const attendingIds = matchStats.filter(s => s.attendance === 'attending').map(s => s.playerId);
      const currentAttendingPlayers = players.filter(p => attendingIds.includes(p.id));
      const currentSquadSize = currentAttendingPlayers.length;

      if (currentSquadSize < 5) return; // Mínimo 5 jugadores

      const reasons: { type: 'positive' | 'negative' | 'neutral', text: string }[] = [];
      let totalScore = 50; // Empezamos con una base de 50 sobre 100

      // 1. Nivel Técnico (Base Rating)
      const currentAttendingRatings = allPlayerRatings
        .filter(p => attendingIds.includes(p.id))
        .map(p => p.rating);
      const currentAvgBaremo = currentAttendingRatings.reduce((a, b) => a + b, 0) / currentSquadSize;

      const squadRatio = currentAvgBaremo / (teamAvgBaremo || 1);
      // squadRatio 1.0 = base de 50 (no suma ni resta).
      // Cada 1% de diferencia aporta +1 o -1
      const diff = (squadRatio - 1) * 100;
      totalScore += diff * 1.5; // multiplicador de peso

      if (diff > 5) reasons.push({ type: 'positive', text: \`Nivel técnico superior (+$\{diff.toFixed(0)}% de la media)\` });
      else if (diff < -5) reasons.push({ type: 'negative', text: \`Nivel técnico inferior ($\{diff.toFixed(0)}%)\` });

      // 2. Equilibrio Táctico
      const hasGoalkeeper = currentAttendingPlayers.some(p => p.position === 'Portero');
      const defendersCount = currentAttendingPlayers.filter(p => p.position === 'Defensa').length;
      const attackersCount = currentAttendingPlayers.filter(p => p.position === 'Delantero').length;

      if (!hasGoalkeeper) {
        totalScore -= 15;
        reasons.push({ type: 'negative', text: 'Sin portero especialista' });
      } else {
        totalScore += 5;
        reasons.push({ type: 'positive', text: 'Portería cubierta' });
      }

      if (defendersCount < 2 && currentSquadSize >= 7) {
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

      // 3. Edad y Equilibrio Físico
      const calculateAge = (birthDate: string) => {
        if (!birthDate) return 25;
        const birth = new Date(birthDate);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) {
          age--;
        }
        return age;
      };

      const ages = currentAttendingPlayers.map(p => calculateAge(p.birthDate));
      const avgAge = ages.reduce((a, b) => a + b, 0) / ages.length;
      
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

      // 4. Química (Sinergias)
      let synergiesFound = 0;
      for (let i = 0; i < currentAttendingPlayers.length; i++) {
        for (let j = i + 1; j < currentAttendingPlayers.length; j++) {
          const p1 = currentAttendingPlayers[i];
          const p2 = currentAttendingPlayers[j];
          const matchesTogether = allMatchesWithScores.filter(m => 
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
        reasons.push({ type: 'positive', text: \`Química letal: \${synergiesFound} dúos probados\` });
      }

      // 5. Profundidad de plantilla
      if (currentSquadSize >= 10) {
        totalScore += 10;
        reasons.push({ type: 'positive', text: \`Mucha profundidad (\${currentSquadSize} jugadores)\` });
      } else if (currentSquadSize <= 6) {
        totalScore -= 10;
        reasons.push({ type: 'negative', text: \`Plantilla corta (\${currentSquadSize} jugadores), riesgo físico\` });
      }

      // Normalizar score final a 0-100
      totalScore = Math.max(0, Math.min(100, totalScore));

      // Asignar Grado
      let grade = 'C';
      if (totalScore >= 85) grade = 'S';
      else if (totalScore >= 75) grade = 'A';
      else if (totalScore >= 60) grade = 'B';
      else if (totalScore >= 45) grade = 'C';
      else grade = 'D';

      result.set(match.id, {
        score: Math.round(totalScore),
        grade,
        reasons,
        attendingCount: currentSquadSize
      });
    });

    return result;
  }, [filteredMatches, allPlayerRatings, stats, players, matches]);

`;

// Let's insert it right underneath `const predictionMap = new Map... return predictionMap; }, [matches, stats, allPlayerRatings, scheduledMatches, standings]);`
const insertionPoint = '  }, [matches, stats, allPlayerRatings, scheduledMatches, standings]);';

const newCode = code.replace(insertionPoint, insertionPoint + '\n' + squadsLogic);
fs.writeFileSync('src/components/AIAnalysis.tsx', newCode);
