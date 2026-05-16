import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';

const BLUE = '#1e3a5f';
const LIGHT_BLUE = '#e8f0fe';
const RED = '#dc2626';
const ORANGE = '#ea580c';
const YELLOW = '#ca8a04';
const BLUE_BADGE = '#2563eb';
const GRAY = '#6b7280';
const LIGHT_GRAY = '#f3f4f6';
const BORDER = '#e5e7eb';

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 9, color: '#111827', paddingBottom: 50 },
  header: { backgroundColor: BLUE, padding: '16 24', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { color: '#ffffff', fontSize: 16, fontFamily: 'Helvetica-Bold', letterSpacing: 1 },
  headerSub: { color: '#93c5fd', fontSize: 8, marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  headerLabel: { color: '#93c5fd', fontSize: 7, textTransform: 'uppercase' },
  headerValue: { color: '#ffffff', fontSize: 9, fontFamily: 'Helvetica-Bold', marginTop: 1 },
  metaBlock: { backgroundColor: LIGHT_BLUE, padding: '10 24', flexDirection: 'row', flexWrap: 'wrap', gap: 8, borderBottomWidth: 1, borderBottomColor: '#bfdbfe' },
  metaItem: { minWidth: '30%', flex: 1 },
  metaLabel: { fontSize: 7, color: GRAY, textTransform: 'uppercase', marginBottom: 2 },
  metaValue: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#111827' },
  body: { padding: '16 24' },
  summaryBox: { backgroundColor: LIGHT_GRAY, borderRadius: 4, padding: '10 12', marginBottom: 14, borderLeftWidth: 3, borderLeftColor: BLUE },
  summaryTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: BLUE, marginBottom: 4 },
  summaryText: { fontSize: 8.5, color: '#374151', lineHeight: 1.5 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  statBox: { flex: 1, borderRadius: 4, padding: '10 12', alignItems: 'center' },
  statValue: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  statLabel: { fontSize: 7, textTransform: 'uppercase', color: GRAY },
  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: BLUE, borderBottomWidth: 1.5, borderBottomColor: BLUE, paddingBottom: 4, marginBottom: 12 },
  finding: { marginBottom: 16, borderWidth: 1, borderColor: BORDER, borderRadius: 4, overflow: 'hidden' },
  findingHeader: { padding: '8 12', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  findingRef: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#ffffff', marginRight: 8 },
  findingCategory: { fontSize: 7.5, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  severityBadge: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#ffffff', backgroundColor: 'rgba(255,255,255,0.2)', padding: '2 6', borderRadius: 10 },
  findingBody: { padding: '10 12' },
  qcBox: { backgroundColor: '#fef2f2', borderRadius: 3, padding: '6 10', marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  qcLabel: { fontSize: 7.5, color: RED, textTransform: 'uppercase', fontFamily: 'Helvetica-Bold' },
  qcAmount: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: RED },
  elementRow: { marginBottom: 7 },
  elementLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: GRAY, marginBottom: 2 },
  elementText: { fontSize: 8.5, color: '#374151', lineHeight: 1.5 },
  criteriaBox: { backgroundColor: '#eff6ff', borderRadius: 3, padding: '5 8', borderLeftWidth: 2, borderLeftColor: BLUE_BADGE },
  txSection: { marginTop: 8 },
  txTitle: { fontSize: 7, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: GRAY, marginBottom: 4 },
  txTable: { borderWidth: 1, borderColor: BORDER, borderRadius: 3 },
  txHeaderRow: { flexDirection: 'row', backgroundColor: LIGHT_GRAY, padding: '4 6', borderBottomWidth: 1, borderBottomColor: BORDER },
  txRow: { flexDirection: 'row', padding: '4 6', borderBottomWidth: 1, borderBottomColor: BORDER },
  txRowLast: { flexDirection: 'row', padding: '4 6' },
  txColDate: { width: '13%', fontSize: 7.5 },
  txColDesc: { flex: 1, fontSize: 7.5 },
  txColVendor: { width: '20%', fontSize: 7.5 },
  txColAmt: { width: '14%', fontSize: 7.5, textAlign: 'right' },
  txHeaderText: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: GRAY, textTransform: 'uppercase' },
  footer: { position: 'absolute', bottom: 20, left: 24, right: 24, flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 6 },
  footerText: { fontSize: 7, color: GRAY },
  repeatBadge: { fontSize: 7, color: '#7c3aed', backgroundColor: '#f5f3ff', padding: '1 5', borderRadius: 8 },
});

const SEVERITY_COLORS: Record<string, string> = {
  material_weakness: '#991b1b',
  significant_deficiency: '#9a3412',
  material_noncompliance: '#854d0e',
  other: '#1e40af',
};

const SEVERITY_LABELS: Record<string, string> = {
  material_weakness: 'Material Weakness',
  significant_deficiency: 'Significant Deficiency',
  material_noncompliance: 'Material Noncompliance',
  other: 'Other Finding',
};

function fmt(n: number) {
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
}

type Transaction = { id: string; date: string | null; description: string | null; vendor: string | null; amount: number | null };
type Finding = {
  id: string; finding_ref: string; severity: string; category: string | null;
  condition_text: string | null; criteria: string | null; cause: string | null;
  effect: string | null; recommendation: string | null;
  questioned_costs: number; is_repeat: boolean;
  finding_transactions: { transaction_id: string; transactions: Transaction }[];
};
type Report = {
  id: string; created_at: string; overall_score: number;
  total_questioned_costs: number; summary: string | null;
  compliance_findings: Finding[];
};
type Grant = {
  name: string; grant_number: string | null; awarding_agency: string | null;
  cfda_number: string | null; award_amount: number | null;
  period_start: string | null; period_end: string | null;
  organizations: { name: string } | null;
};

interface Props {
  report: Report;
  grant: Grant;
  firmName?: string;
  auditorName?: string;
}

export function ComplianceReportPDF({ report, grant, firmName, auditorName }: Props) {
  const findings = report.compliance_findings ?? [];
  const totalQC = Number(report.total_questioned_costs) || findings.reduce((s, f) => s + (Number(f.questioned_costs) || 0), 0);
  const score = report.overall_score ?? 0;
  const scoreColor = score >= 80 ? '#15803d' : score >= 60 ? '#ca8a04' : RED;
  const reportDate = new Date(report.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header} fixed>
          <View>
            <Text style={styles.headerTitle}>SAUMARITAN</Text>
            <Text style={styles.headerSub}>Grant Compliance Audit Report</Text>
          </View>
          <View style={styles.headerRight}>
            {firmName && <Text style={styles.headerValue}>{firmName}</Text>}
            {auditorName && <Text style={styles.headerLabel}>{auditorName}</Text>}
            <Text style={[styles.headerLabel, { marginTop: 4 }]}>Generated {reportDate}</Text>
          </View>
        </View>

        {/* Grant metadata */}
        <View style={styles.metaBlock}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Organization</Text>
            <Text style={styles.metaValue}>{grant.organizations?.name ?? 'N/A'}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Grant Name</Text>
            <Text style={styles.metaValue}>{grant.name}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Grant Number</Text>
            <Text style={styles.metaValue}>{grant.grant_number ?? 'N/A'}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Awarding Agency</Text>
            <Text style={styles.metaValue}>{grant.awarding_agency ?? 'N/A'}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>CFDA / ALN</Text>
            <Text style={styles.metaValue}>{grant.cfda_number ?? 'N/A'}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Period of Performance</Text>
            <Text style={styles.metaValue}>{grant.period_start} – {grant.period_end}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Award Amount</Text>
            <Text style={styles.metaValue}>{grant.award_amount ? fmt(grant.award_amount) : 'N/A'}</Text>
          </View>
        </View>

        <View style={styles.body}>
          {/* Executive Summary */}
          {report.summary && (
            <View style={styles.summaryBox}>
              <Text style={styles.summaryTitle}>Executive Summary</Text>
              <Text style={styles.summaryText}>{report.summary}</Text>
            </View>
          )}

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={[styles.statBox, { backgroundColor: LIGHT_GRAY, borderWidth: 1, borderColor: BORDER }]}>
              <Text style={[styles.statValue, { color: scoreColor }]}>{score}</Text>
              <Text style={[styles.statLabel, { color: scoreColor }]}>Compliance Score</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' }]}>
              <Text style={[styles.statValue, { color: RED, fontSize: 14 }]}>{fmt(totalQC)}</Text>
              <Text style={styles.statLabel}>Total Questioned Costs</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: LIGHT_GRAY, borderWidth: 1, borderColor: BORDER }]}>
              <Text style={[styles.statValue, { color: BLUE, fontSize: 14 }]}>{findings.length}</Text>
              <Text style={styles.statLabel}>Total Findings</Text>
            </View>
          </View>

          {/* Findings */}
          {findings.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Schedule of Findings and Questioned Costs</Text>
              {findings.map((f, idx) => {
                const bg = SEVERITY_COLORS[f.severity] ?? SEVERITY_COLORS.other;
                const txs = (f.finding_transactions ?? []).map(ft => ft.transactions).filter(Boolean);
                return (
                  <View key={f.id} style={styles.finding} wrap={false}>
                    <View style={[styles.findingHeader, { backgroundColor: bg }]}>
                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.findingRef}>{f.finding_ref}</Text>
                          {f.is_repeat && <Text style={styles.repeatBadge}>Repeat Finding</Text>}
                        </View>
                        {f.category && <Text style={styles.findingCategory}>{f.category}</Text>}
                      </View>
                      <Text style={styles.severityBadge}>{SEVERITY_LABELS[f.severity] ?? f.severity}</Text>
                    </View>

                    <View style={styles.findingBody}>
                      {Number(f.questioned_costs) > 0 && (
                        <View style={styles.qcBox}>
                          <Text style={styles.qcLabel}>Questioned Costs</Text>
                          <Text style={styles.qcAmount}>{fmt(f.questioned_costs)}</Text>
                        </View>
                      )}

                      {f.condition_text && (
                        <View style={styles.elementRow}>
                          <Text style={styles.elementLabel}>Condition</Text>
                          <Text style={styles.elementText}>{f.condition_text}</Text>
                        </View>
                      )}
                      {f.criteria && (
                        <View style={styles.elementRow}>
                          <Text style={styles.elementLabel}>Criteria</Text>
                          <View style={styles.criteriaBox}>
                            <Text style={styles.elementText}>{f.criteria}</Text>
                          </View>
                        </View>
                      )}
                      {f.cause && (
                        <View style={styles.elementRow}>
                          <Text style={styles.elementLabel}>Cause</Text>
                          <Text style={styles.elementText}>{f.cause}</Text>
                        </View>
                      )}
                      {f.effect && (
                        <View style={styles.elementRow}>
                          <Text style={styles.elementLabel}>Effect</Text>
                          <Text style={styles.elementText}>{f.effect}</Text>
                        </View>
                      )}
                      {f.recommendation && (
                        <View style={styles.elementRow}>
                          <Text style={styles.elementLabel}>Recommendation</Text>
                          <Text style={styles.elementText}>{f.recommendation}</Text>
                        </View>
                      )}

                      {txs.length > 0 && (
                        <View style={styles.txSection}>
                          <Text style={styles.txTitle}>Cited Transactions ({txs.length})</Text>
                          <View style={styles.txTable}>
                            <View style={styles.txHeaderRow}>
                              <Text style={[styles.txColDate, styles.txHeaderText]}>Date</Text>
                              <Text style={[styles.txColDesc, styles.txHeaderText]}>Description</Text>
                              <Text style={[styles.txColVendor, styles.txHeaderText]}>Vendor</Text>
                              <Text style={[styles.txColAmt, styles.txHeaderText]}>Amount</Text>
                            </View>
                            {txs.map((t, i) => (
                              <View key={t.id} style={i === txs.length - 1 ? styles.txRowLast : styles.txRow}>
                                <Text style={styles.txColDate}>{t.date ?? '—'}</Text>
                                <Text style={styles.txColDesc}>{t.description ?? '—'}</Text>
                                <Text style={styles.txColVendor}>{t.vendor ?? '—'}</Text>
                                <Text style={styles.txColAmt}>{t.amount != null ? fmt(t.amount) : '—'}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </>
          )}

          {findings.length === 0 && (
            <View style={{ padding: '20 0', alignItems: 'center' }}>
              <Text style={{ fontSize: 10, color: '#15803d', fontFamily: 'Helvetica-Bold' }}>No Findings — Fully Compliant</Text>
              <Text style={{ fontSize: 8, color: GRAY, marginTop: 4 }}>All reviewed transactions appear compliant with the defined grant requirements.</Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>CONFIDENTIAL — For audit purposes only</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
