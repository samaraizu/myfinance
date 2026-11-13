/**
 * ダッシュボードシートを数式＋グラフで構築する。
 * 数式で集計するので、データ追加時の再構築は不要。
 */
function buildDashboard_(ss) {
  const sh = ss.getSheetByName(SHEET.DASHBOARD) || ss.insertSheet(SHEET.DASHBOARD);
  sh.getCharts().forEach((c) => sh.removeChart(c));
  sh.clear();
  sh.clearConditionalFormatRules();

  const R = `'${SHEET.RECEIPTS}'`;
  const I = `'${SHEET.ITEMS}'`;
  const C = `'${SHEET.CATEGORIES}'`;
  const CAT_FIRST = 10;
  const CAT_ROWS = 30;
  const CAT_LAST = CAT_FIRST + CAT_ROWS - 1;

  sh.getRange('A1').setValue('レシート ダッシュボード').setFontSize(16).setFontWeight('bold');

  // KPI（支払額ベース＝レシート合計）
  sh.getRange('A3:A6').setValues([['対象月'], ['当月合計'], ['前月合計'], ['前月比']]).setFontWeight('bold');
  sh.getRange('B3:B6').setFormulas([
    ['=EOMONTH(TODAY(),-1)+1'],
    [`=SUMIFS(${R}!D:D,${R}!B:B,">="&B3,${R}!B:B,"<"&EDATE(B3,1))`],
    [`=SUMIFS(${R}!D:D,${R}!B:B,">="&EDATE(B3,-1),${R}!B:B,"<"&B3)`],
    ['=IF(B5=0,"-",B4/B5-1)'],
  ]);
  sh.getRange('B3').setNumberFormat('yyyy年m月');
  sh.getRange('B4:B5').setNumberFormat('¥#,##0').setFontSize(14).setFontWeight('bold');
  sh.getRange('B6').setNumberFormat('+0.0%;-0.0%;0.0%');
  sh.getRange('C3').setValue('※ 当月合計・月別推移は支払額（税込）、カテゴリ・ランキングは明細ベース').setFontColor('#888888');

  // カテゴリ別（当月）
  sh.getRange('A8').setValue('カテゴリ別支出（当月）').setFontWeight('bold');
  sh.getRange('A9:D9').setValues([['カテゴリ', '当月支出', '月予算', '予算比']]).setFontWeight('bold').setBackground('#eeeeee');
  const catFormulas = [];
  for (let r = CAT_FIRST; r <= CAT_LAST; r++) {
    catFormulas.push([
      `=IFERROR(INDEX(FILTER(${C}!A$2:A,${C}!A$2:A<>""),${r - CAT_FIRST + 1}),"")`,
      `=IF(A${r}="","",SUMIFS(${I}!H:H,${I}!E:E,A${r},${I}!A:A,">="&$B$3,${I}!A:A,"<"&EDATE($B$3,1)))`,
      `=IF(A${r}="","",IFNA(VLOOKUP(A${r},${C}!A:B,2,FALSE),""))`,
      `=IF(N(C${r})=0,"",B${r}/C${r})`,
    ]);
  }
  sh.getRange(CAT_FIRST, 1, CAT_ROWS, 4).setFormulas(catFormulas);
  sh.getRange(CAT_FIRST, 2, CAT_ROWS, 2).setNumberFormat('¥#,##0');
  sh.getRange(CAT_FIRST, 4, CAT_ROWS, 1).setNumberFormat('0%');

  const catRange = sh.getRange(CAT_FIRST, 1, CAT_ROWS, 4);
  sh.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(`=AND(N($C${CAT_FIRST})>0,N($B${CAT_FIRST})>N($C${CAT_FIRST}))`)
      .setBackground('#f4cccc').setFontColor('#990000').setRanges([catRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(`=AND(N($C${CAT_FIRST})>0,N($B${CAT_FIRST})>=N($C${CAT_FIRST})*0.8)`)
      .setBackground('#fff2cc').setRanges([catRange]).build(),
  ]);

  // 月別推移（直近12か月）
  sh.getRange('F8').setValue('月別支出（直近12か月）').setFontWeight('bold');
  sh.getRange('F9:G9').setValues([['月', '支出']]).setFontWeight('bold').setBackground('#eeeeee');
  const trend = [];
  for (let i = 0; i < 12; i++) {
    const r = 10 + i;
    trend.push([
      `=EDATE($B$3,${i - 11})`,
      `=SUMIFS(${R}!D:D,${R}!B:B,">="&F${r},${R}!B:B,"<"&EDATE(F${r},1))`,
    ]);
  }
  sh.getRange('F10:G21').setFormulas(trend);
  sh.getRange('F10:F21').setNumberFormat('yyyy/mm');
  sh.getRange('G10:G21').setNumberFormat('¥#,##0');

  // よく買う品目ランキング
  const rankQuery = (orderBy) => `=IFERROR(QUERY(${I}!D2:H,"select D, count(D), sum(H) where D is not null and D <> '' group by D order by ${orderBy} desc limit 10 label D '品目', count(D) '回数', sum(H) '金額'",0),"データなし")`;
  sh.getRange('I8').setValue('よく買う品目 TOP10（回数）').setFontWeight('bold');
  sh.getRange('I9').setFormula(rankQuery('count(D)'));
  sh.getRange('M8').setValue('よく買う品目 TOP10（金額）').setFontWeight('bold');
  sh.getRange('M9').setFormula(rankQuery('sum(H)'));
  sh.getRange('K10:K19').setNumberFormat('¥#,##0');
  sh.getRange('O10:O19').setNumberFormat('¥#,##0');
  sh.getRangeList(['I9:K9', 'M9:O9']).setFontWeight('bold').setBackground('#eeeeee');

  // グラフ
  const chartRow = CAT_LAST + 2;
  sh.insertChart(sh.newChart()
    .setChartType(Charts.ChartType.PIE)
    .addRange(sh.getRange(`A9:B${CAT_LAST}`))
    .setNumHeaders(1)
    .setOption('title', 'カテゴリ別支出（当月）')
    .setOption('pieHole', 0.4)
    .setOption('width', 480).setOption('height', 340)
    .setPosition(chartRow, 1, 0, 0)
    .build());
  sh.insertChart(sh.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(sh.getRange('F9:G21'))
    .setNumHeaders(1)
    .setOption('title', '月別支出（直近12か月）')
    .setOption('legend', { position: 'none' })
    .setOption('width', 560).setOption('height', 340)
    .setPosition(chartRow, 6, 0, 0)
    .build());

  sh.setColumnWidth(1, 160);
  sh.setColumnWidths(9, 1, 180);
  sh.setColumnWidths(13, 1, 180);
  sh.setFrozenRows(0);
}
