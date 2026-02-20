"use client";

import { useCallback, useEffect, useState } from "react";
import { useMovementSDK } from "@movement-labs/miniapp-sdk";
import { CERTIFICATES_MODULE_ADDRESS } from "../../constants";

type Template = { name: string; description: string };
type Certificate = {
  templateIndex: number;
  recipient: string;
  studentName: string;
  className: string;
  grades: string;
};
type CertRef = { issuer: string; index: number };
type IssuedCert = { index: number; cert: Certificate };
type PrintCert = { cert: Certificate; issuer: string; index: number; templateName?: string };

const MOD = CERTIFICATES_MODULE_ADDRESS;

function getCertificateShareMessage(p: PrintCert): string {
  return `Certificate of Achievement for ${p.cert.studentName}${p.templateName ? ` · ${p.templateName}` : ""}. To claim: use issuer ${p.issuer} and index ${p.index}.`;
}

function unwrapView<T>(result: unknown): T {
  const arr = Array.isArray(result) ? result : [result];
  return (arr.length === 1 ? arr[0] : arr) as T;
}

export default function CertificatesPage() {
  const { sdk, isConnected, address } = useMovementSDK();
  const [activeTab, setActiveTab] = useState<"mine" | "issued" | "issue">("mine");
  const [certRefs, setCertRefs] = useState<CertRef[]>([]);
  const [certDetails, setCertDetails] = useState<Map<string, Certificate>>(new Map());
  const [issuedCerts, setIssuedCerts] = useState<IssuedCert[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastIssued, setLastIssued] = useState<{ index: number; recipientName: string } | null>(null);
  const [printCert, setPrintCert] = useState<PrintCert | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Create template form
  const [templateName, setTemplateName] = useState("");
  const [templateDesc, setTemplateDesc] = useState("");
  // Issue form
  const [issueTemplateIndex, setIssueTemplateIndex] = useState("0");
  const [issueRecipient, setIssueRecipient] = useState("");
  const [issueStudentName, setIssueStudentName] = useState("");
  const [issueClassName, setIssueClassName] = useState("");
  const [issueGrades, setIssueGrades] = useState("");
  // Claim form
  const [claimIssuer, setClaimIssuer] = useState("");
  const [claimIndex, setClaimIndex] = useState("");

  const fetchMyCertificates = useCallback(async () => {
    if (!sdk || !address) return;
    setError("");
    try {
      const countRes = await sdk.view({
        function: `${MOD}::certificates::get_recipient_cert_count`,
        type_arguments: [],
        function_arguments: [address],
      });
      const count = Number(unwrapView<number>(countRes) || 0);
      const refs: CertRef[] = [];
      for (let i = 0; i < count; i++) {
        const refRes = await sdk.view({
          function: `${MOD}::certificates::get_recipient_cert_ref`,
          type_arguments: [],
          function_arguments: [address, String(i)],
        });
        const [issuer, index] = unwrapView<[string, number]>(refRes);
        refs.push({ issuer, index });
      }
      setCertRefs(refs);
      const details = new Map<string, Certificate>();
      for (const { issuer, index } of refs) {
        const certRes = await sdk.view({
          function: `${MOD}::certificates::get_certificate`,
          type_arguments: [],
          function_arguments: [issuer, String(index)],
        });
        const [templateIndex, recipient, studentName, className, grades] =
          unwrapView<[number, string, string, string, string]>(certRes);
        details.set(`${issuer}:${index}`, {
          templateIndex,
          recipient,
          studentName,
          className,
          grades,
        });
      }
      setCertDetails(details);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Failed to load certificates");
    }
  }, [sdk, address]);

  const fetchTemplates = useCallback(async () => {
    if (!sdk || !address) return;
    try {
      const isIssuerRes = await sdk.view({
        function: `${MOD}::certificates::is_issuer`,
        type_arguments: [],
        function_arguments: [address],
      });
      if (!unwrapView<boolean>(isIssuerRes)) {
        setTemplates([]);
        return;
      }
      const countRes = await sdk.view({
        function: `${MOD}::certificates::get_template_count`,
        type_arguments: [],
        function_arguments: [address],
      });
      const count = Number(unwrapView<number>(countRes) || 0);
      const list: Template[] = [];
      for (let i = 0; i < count; i++) {
        const tRes = await sdk.view({
          function: `${MOD}::certificates::get_template`,
          type_arguments: [],
          function_arguments: [address, String(i)],
        });
        const [name, description] = unwrapView<[string, string]>(tRes);
        list.push({ name, description });
      }
      setTemplates(list);
    } catch (e) {
      console.error(e);
      setTemplates([]);
    }
  }, [sdk, address]);

  const fetchIssuedCertificates = useCallback(async () => {
    if (!sdk || !address) return;
    try {
      const countRes = await sdk.view({
        function: `${MOD}::certificates::get_certificate_count`,
        type_arguments: [],
        function_arguments: [address],
      });
      const count = Number(unwrapView<number>(countRes) || 0);
      const list: IssuedCert[] = [];
      for (let i = 0; i < count; i++) {
        const certRes = await sdk.view({
          function: `${MOD}::certificates::get_certificate`,
          type_arguments: [],
          function_arguments: [address, String(i)],
        });
        const [templateIndex, recipient, studentName, className, grades] =
          unwrapView<[number, string, string, string, string]>(certRes);
        list.push({
          index: i,
          cert: { templateIndex, recipient, studentName, className, grades },
        });
      }
      setIssuedCerts(list);
    } catch (e) {
      console.error(e);
      setIssuedCerts([]);
    }
  }, [sdk, address]);

  useEffect(() => {
    if (isConnected && address && sdk) {
      fetchMyCertificates();
      fetchTemplates();
      fetchIssuedCertificates();
    }
  }, [isConnected, address, sdk, fetchMyCertificates, fetchTemplates, fetchIssuedCertificates]);

  const handleCreateTemplate = async () => {
    if (!sdk || !isConnected || !templateName.trim()) {
      setError("Enter a template name");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await sdk.haptic?.({ type: "impact", style: "light" });
      await sdk.sendTransaction({
        function: `${MOD}::certificates::create_template`,
        type_arguments: [],
        arguments: [templateName.trim(), templateDesc.trim()],
        title: "Create certificate template",
        description: `Create template: ${templateName.trim()}`,
        amount: "0",
        useFeePayer: true,
        gasLimit: "Sponsored",
      } as Parameters<typeof sdk.sendTransaction>[0]);
      setTemplateName("");
      setTemplateDesc("");
      await fetchTemplates();
      await sdk.notify?.({ title: "Template created", body: templateName.trim() });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create template");
    } finally {
      setLoading(false);
    }
  };

  const handleIssueCertificate = async () => {
    if (!sdk || !isConnected || !issueRecipient.trim() || !issueStudentName.trim()) {
      setError("Fill recipient address and student name");
      return;
    }
    const templateIndex = parseInt(issueTemplateIndex, 10);
    if (isNaN(templateIndex) || templateIndex < 0 || templateIndex >= templates.length) {
      setError("Invalid template index");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await sdk.haptic?.({ type: "impact", style: "medium" });
      await sdk.sendTransaction({
        function: `${MOD}::certificates::issue_certificate`,
        type_arguments: [],
        arguments: [
          String(templateIndex),
          issueRecipient.trim(),
          issueStudentName.trim(),
          issueClassName.trim(),
          issueGrades.trim(),
        ],
        title: "Issue certificate",
        description: `Issue to ${issueStudentName.trim()}`,
        amount: "0",
        useFeePayer: true,
        gasLimit: "Sponsored",
      } as Parameters<typeof sdk.sendTransaction>[0]);
      const countRes = await sdk.view({
        function: `${MOD}::certificates::get_certificate_count`,
        type_arguments: [],
        function_arguments: [address],
      });
      const count = Number(unwrapView<number>(countRes) || 0);
      const newIndex = Math.max(0, count - 1);
      setLastIssued({ index: newIndex, recipientName: issueStudentName.trim() });
      await fetchIssuedCertificates();
      setIssueRecipient("");
      setIssueStudentName("");
      setIssueClassName("");
      setIssueGrades("");
      await sdk.notify?.({
        title: "Certificate issued",
        body: `Index: ${newIndex}. Share your address + index ${newIndex} with ${issueStudentName.trim()} to claim.`,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to issue certificate");
    } finally {
      setLoading(false);
    }
  };

  const handleClaimCertificate = async () => {
    if (!sdk || !isConnected || !claimIssuer.trim() || claimIndex.trim() === "") {
      setError("Enter issuer address and certificate index");
      return;
    }
    const index = parseInt(claimIndex, 10);
    if (isNaN(index) || index < 0) {
      setError("Invalid certificate index");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await sdk.haptic?.({ type: "impact", style: "medium" });
      await sdk.sendTransaction({
        function: `${MOD}::certificates::claim_certificate`,
        type_arguments: [],
        arguments: [claimIssuer.trim(), String(index)],
        title: "Claim certificate",
        description: "Add this certificate to your wallet",
        amount: "0",
        useFeePayer: true,
        gasLimit: "Sponsored",
      } as Parameters<typeof sdk.sendTransaction>[0]);
      setClaimIssuer("");
      setClaimIndex("");
      await fetchMyCertificates();
      await sdk.notify?.({ title: "Certificate claimed", body: "Added to your list." });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to claim certificate");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-6 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="w-full max-w-lg mx-auto space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Certificates
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            On-chain certificate NFTs (RWA) — issue and view
          </p>
        </div>

        {!isConnected ? (
          <div className="rounded-2xl bg-white dark:bg-slate-800 shadow-lg p-6 text-center text-slate-600 dark:text-slate-400">
            Connect your wallet to view or issue certificates.
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex rounded-xl bg-slate-200 dark:bg-slate-700 p-1">
              <button
                type="button"
                onClick={() => setActiveTab("mine")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                  activeTab === "mine"
                    ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                My certificates
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("issued")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                  activeTab === "issued"
                    ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                My issued
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("issue")}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                  activeTab === "issue"
                    ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                Issue / Claim
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            {activeTab === "mine" && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-white dark:bg-slate-800 shadow-lg p-6">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                    Your certificates
                  </h2>
                  {certRefs.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      No certificates yet. Claim one using the &quot;Issue / Claim&quot; tab.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {certRefs.map((ref) => {
                        const key = `${ref.issuer}:${ref.index}`;
                        const cert = certDetails.get(key);
                        return (
                          <li
                            key={key}
                            className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600"
                          >
                            {cert ? (
                              <>
                                <p className="font-medium text-slate-900 dark:text-white">
                                  {cert.studentName}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                  Class: {cert.className || "—"} · Grades: {cert.grades || "—"}
                                </p>
                                <p className="text-xs font-mono text-slate-400 dark:text-slate-500 mt-1 truncate">
                                  Issuer: {ref.issuer.slice(0, 8)}...{ref.issuer.slice(-6)} · Index: {ref.index}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setPrintCert({ cert, issuer: ref.issuer, index: ref.index })}
                                  className="mt-3 text-sm font-medium text-amber-700 hover:text-amber-800 dark:text-amber-400"
                                >
                                  View / Share certificate
                                </button>
                              </>
                            ) : (
                              <p className="text-sm text-slate-500">Loading…</p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {activeTab === "issued" && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-white dark:bg-slate-800 shadow-lg p-6">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                    Certificates you issued
                  </h2>
                  {issuedCerts.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      No certificates issued yet. Use Issue / Claim to issue one.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {issuedCerts.map(({ index: certIndex, cert }) => {
                        const templateName = cert.templateIndex < templates.length ? templates[cert.templateIndex]?.name : undefined;
                        return (
                          <li
                            key={`${address}:${certIndex}`}
                            className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600"
                          >
                            <p className="font-medium text-slate-900 dark:text-white">
                              {cert.studentName}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              Class: {cert.className || "—"} · Grades: {cert.grades || "—"}
                            </p>
                            <p className="text-xs font-mono text-slate-400 dark:text-slate-500 mt-1">
                              Index: {certIndex} · To: {cert.recipient.slice(0, 8)}...{cert.recipient.slice(-6)}
                            </p>
                            <p className="text-xs text-slate-500 mt-2">
                              Share with recipient: your address + index <strong>{certIndex}</strong>
                            </p>
                            <button
                              type="button"
                              onClick={() => address && setPrintCert({ cert, issuer: address, index: certIndex, templateName })}
                              className="mt-3 text-sm font-medium text-amber-700 hover:text-amber-800 dark:text-amber-400"
                            >
                              View / Share certificate
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {activeTab === "issue" && (
              <div className="space-y-6">
                {/* Create template */}
                <div className="rounded-2xl bg-white dark:bg-slate-800 shadow-lg p-6">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                    Create template
                  </h2>
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Template name (e.g. University Diploma 2025)"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Description"
                      value={templateDesc}
                      onChange={(e) => setTemplateDesc(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleCreateTemplate}
                      disabled={loading || !templateName.trim()}
                      className="w-full py-3 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:pointer-events-none text-white font-medium text-sm"
                    >
                      {loading ? "Creating…" : "Create template"}
                    </button>
                  </div>
                </div>

                {/* Issue certificate */}
                <div className="rounded-2xl bg-white dark:bg-slate-800 shadow-lg p-6">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                    Issue certificate
                  </h2>
                  <div className="space-y-3">
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                      Template index
                    </label>
                    <select
                      value={issueTemplateIndex}
                      onChange={(e) => setIssueTemplateIndex(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
                    >
                      {templates.map((t, i) => (
                        <option key={i} value={i}>
                          {i}: {t.name}
                        </option>
                      ))}
                      {templates.length === 0 && (
                        <option value="0">Create a template first</option>
                      )}
                    </select>
                    <input
                      type="text"
                      placeholder="Recipient wallet address"
                      value={issueRecipient}
                      onChange={(e) => setIssueRecipient(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 text-sm font-mono"
                    />
                    <input
                      type="text"
                      placeholder="Student name"
                      value={issueStudentName}
                      onChange={(e) => setIssueStudentName(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Class"
                      value={issueClassName}
                      onChange={(e) => setIssueClassName(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Grades (e.g. 3.8 GPA)"
                      value={issueGrades}
                      onChange={(e) => setIssueGrades(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleIssueCertificate}
                      disabled={loading || templates.length === 0 || !issueRecipient.trim() || !issueStudentName.trim()}
                      className="w-full py-3 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:pointer-events-none text-white font-medium text-sm"
                    >
                      {loading ? "Issuing…" : "Issue certificate"}
                    </button>
                    {lastIssued !== null && address && (
                      <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
                        <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
                          Certificate issued to {lastIssued.recipientName}
                        </p>
                        <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-300">
                          <strong>Index: {lastIssued.index}</strong>
                        </p>
                        <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                          Share with recipient so they can claim: your address and index {lastIssued.index}
                        </p>
                        <p className="mt-2 font-mono text-xs text-emerald-600 dark:text-emerald-500 break-all">
                          {address}
                        </p>
                        <button
                          type="button"
                          onClick={() => setLastIssued(null)}
                          className="mt-2 text-xs text-emerald-600 hover:underline dark:text-emerald-400"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Claim certificate */}
                <div className="rounded-2xl bg-white dark:bg-slate-800 shadow-lg p-6">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                    Claim a certificate
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    If an issuer sent you a certificate, enter their address and the certificate index to add it to your wallet.
                  </p>
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Issuer wallet address"
                      value={claimIssuer}
                      onChange={(e) => setClaimIssuer(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 text-sm font-mono"
                    />
                    <input
                      type="text"
                      placeholder="Certificate index (number)"
                      value={claimIndex}
                      onChange={(e) => setClaimIndex(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleClaimCertificate}
                      disabled={loading || !claimIssuer.trim() || claimIndex.trim() === ""}
                      className="w-full py-3 px-4 rounded-lg border-2 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:pointer-events-none text-slate-900 dark:text-white font-medium text-sm"
                    >
                      {loading ? "Claiming…" : "Claim certificate"}
                    </button>
                  </div>
                </div>
              </div>
            )}

        {address && (
          <p className="text-center text-xs text-slate-500 dark:text-slate-400 font-mono">
            {address.slice(0, 6)}...{address.slice(-4)}
          </p>
        )}

            {/* Certificate print view (graduation style, landscape 8.5x11) */}
            {printCert && (
              <div className="fixed inset-0 z-50 flex flex-col bg-black/60 p-3 print:bg-white print:p-0">
                {/* Button bar above certificate */}
                <div className="mb-3 flex flex-shrink-0 justify-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!sdk?.share) return;
                      const msg = getCertificateShareMessage(printCert);
                      const url = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "";
                      await sdk.share({ message: msg, url, title: "Certificate" });
                    }}
                    className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
                  >
                    Share
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const msg = getCertificateShareMessage(printCert);
                      try {
                        if (sdk?.Clipboard?.writeText) {
                          await sdk.Clipboard.writeText(msg);
                        } else if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
                          await navigator.clipboard.writeText(msg);
                        } else {
                          setError("Clipboard not available");
                          return;
                        }
                        setCopyFeedback(true);
                        setTimeout(() => setCopyFeedback(false), 2000);
                        await sdk?.notify?.({ title: "Copied", body: "Certificate details copied to clipboard" });
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Copy failed");
                      }
                    }}
                    className="rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                  >
                    {copyFeedback ? "Copied!" : "Copy"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrintCert(null)}
                    className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
                  >
                    Close
                  </button>
                </div>
                {/* Certificate frame - fits viewport, no cutoff */}
                <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-1">
                  <div
                    className="certificate-print-root relative flex w-full flex-col overflow-hidden rounded-lg bg-[#faf8f0] shadow-2xl print:max-w-none print:rounded-none print:shadow-none"
                    style={{
                      // Fit in viewport: limit width so that aspect-ratio height doesn't exceed available height
                      width: "100%",
                      maxWidth: "min(calc(100vw - 1.5rem), calc((100vh - 5rem) * 11 / 8.5))",
                      aspectRatio: "11 / 8.5",
                      maxHeight: "calc(100vh - 5rem)",
                      border: "8px solid #b8860b",
                      boxShadow: "inset 0 0 0 3px #8b6914",
                    }}
                  >
                    <div className="absolute left-4 top-4 text-amber-800/25 text-2xl sm:left-6 sm:top-6 sm:text-3xl">◆</div>
                    <div className="absolute right-4 top-4 text-amber-800/25 text-2xl sm:right-6 sm:top-6 sm:text-3xl">◆</div>
                    <div className="absolute bottom-4 left-4 text-amber-800/25 text-2xl sm:bottom-6 sm:left-6 sm:text-3xl">◆</div>
                    <div className="absolute bottom-4 right-4 text-amber-800/25 text-2xl sm:bottom-6 sm:right-6 sm:text-3xl">◆</div>
                    <div className="flex flex-1 flex-col items-center justify-center px-6 py-6 text-center sm:px-10 sm:py-8 print:py-12">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.35em] text-amber-900/90 print:text-sm">
                        Certificate of Achievement
                      </p>
                      <div className="mb-4 h-0.5 w-20 bg-amber-700/60 sm:mb-5" />
                      <p className="mb-2 text-sm text-stone-600 print:text-base">
                        This is to certify that
                      </p>
                      <h2 className="mb-4 font-serif text-2xl font-bold text-stone-900 sm:mb-5 sm:text-3xl print:text-4xl">
                        {printCert.cert.studentName}
                      </h2>
                      <p className="mb-1 text-sm text-stone-600 print:text-base">
                        has successfully completed the requirements and is hereby awarded
                      </p>
                      {printCert.templateName && (
                        <p className="mb-3 font-semibold text-amber-900 print:text-lg">
                          {printCert.templateName}
                        </p>
                      )}
                      {(printCert.cert.className || printCert.cert.grades) && (
                        <p className="mb-4 text-sm text-stone-600 sm:mb-5 print:text-base">
                          {[printCert.cert.className, printCert.cert.grades].filter(Boolean).join(" · ")}
                        </p>
                      )}
                      <div className="mb-4 h-0.5 w-28 bg-amber-700/60 sm:mb-6" />
                      <p className="text-xs text-stone-500 print:text-sm">
                        Issued on-chain · Certificate index: {printCert.index}
                      </p>
                      <p className="mt-1 font-mono text-xs text-stone-400 print:text-sm">
                        {printCert.issuer.slice(0, 10)}...{printCert.issuer.slice(-8)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
