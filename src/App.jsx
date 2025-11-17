import { useState, useMemo, memo, useCallback } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Moon,
  Sun,
  Download,
  Copy,
  Search,
  X,
  BarChart3,
  Clock,
  FileJson,
  Eye,
  EyeOff,
} from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLevels, setSelectedLevels] = useState(["H1", "H2", "H3"]);
  const [showStats, setShowStats] = useState(true);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileInput = useCallback((e) => {
    if (e.target.files?.[0]) {
      handleFile(e.target.files[0]);
    }
  }, []);

  const handleFile = useCallback((selectedFile) => {
    if (selectedFile.type === "application/pdf") {
      setFile(selectedFile);
      setError(null);
    } else {
      setError("Please select a PDF file");
      setFile(null);
    }
  }, []);

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const { data } = await axios.post(
        `${API_URL}/api/extract-headings`,
        formData
      );
      setResult(data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to process PDF");
    } finally {
      setLoading(false);
    }
  };

  const reset = useCallback(() => {
    setFile(null);
    setResult(null);
    setError(null);
    setSearchQuery("");
  }, []);

  const toggleLevel = useCallback((level) => {
    setSelectedLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  }, []);

  const filteredHeadings = useMemo(() => {
    if (!result?.outline) return [];
    const query = searchQuery.toLowerCase();
    return result.outline.filter(
      (h) =>
        selectedLevels.includes(h.level) && h.text.toLowerCase().includes(query)
    );
  }, [result?.outline, searchQuery, selectedLevels]);

  const stats = useMemo(() => {
    if (!result?.outline) return null;
    return {
      h1: result.outline.filter((h) => h.level === "H1").length,
      h2: result.outline.filter((h) => h.level === "H2").length,
      h3: result.outline.filter((h) => h.level === "H3").length,
      total: result.total_headings,
    };
  }, [result?.outline, result?.total_headings]);

  const exportJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json",
    });
    downloadBlob(blob, `${result.filename.replace(".pdf", "")}_headings.json`);
  }, [result]);

  const exportText = useCallback(() => {
    let text = `${result.title}\n${"=".repeat(result.title.length)}\n\n`;
    result.outline.forEach((h) => {
      const indent = "  ".repeat(["H1", "H2", "H3"].indexOf(h.level));
      text += `${indent}${h.text} (Page ${h.page})\n`;
    });
    const blob = new Blob([text], { type: "text/plain" });
    downloadBlob(blob, `${result.filename.replace(".pdf", "")}_outline.txt`);
  }, [result]);

  const copyToClipboard = useCallback(async () => {
    const text = result.outline
      .map((h) => {
        const indent = "  ".repeat(["H1", "H2", "H3"].indexOf(h.level));
        return `${indent}${h.text} (Page ${h.page})`;
      })
      .join("\n");
    await navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  }, [result?.outline]);

  return (
    <div
      className={
        darkMode
          ? "bg-gray-900 min-h-screen"
          : "bg-linear-to-br from-blue-50 via-indigo-50 to-purple-50 min-h-screen"
      }
    >
      <div className="py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-between items-start mb-6">
              <div className="flex-1" />
              <div className="flex-1 flex justify-center">
                <div
                  className={`${
                    darkMode
                      ? "bg-blue-600"
                      : "bg-linear-to-br from-blue-600 to-purple-600"
                  } p-4 rounded-2xl shadow-2xl`}
                >
                  <FileText className="w-12 h-12 text-white" />
                </div>
              </div>
              <div className="flex-1 flex justify-end">
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className={`p-3 rounded-xl shadow-lg transition-transform hover:scale-110 ${
                    darkMode
                      ? "bg-gray-800 text-yellow-400"
                      : "bg-white text-gray-700"
                  }`}
                >
                  {darkMode ? (
                    <Sun className="w-6 h-6" />
                  ) : (
                    <Moon className="w-6 h-6" />
                  )}
                </button>
              </div>
            </div>

            <h1
              className={`text-5xl font-black mb-3 ${
                darkMode ? "text-white" : "text-gray-900"
              }`}
            >
              PDF Heading Extractor
            </h1>
            <p
              className={`text-lg ${
                darkMode ? "text-gray-300" : "text-gray-600"
              }`}
            >
              Extract hierarchical headings with AI-powered analysis
            </p>
          </div>

          {/* Main Card */}
          <div
            className={`rounded-3xl shadow-2xl ${
              darkMode ? "bg-gray-800 border border-gray-700" : "bg-white"
            }`}
          >
            {/* Upload Section */}
            {!result ? (
              <div className="p-8">
                <div
                  className={`border-3 border-dashed rounded-2xl p-16 text-center transition-colors ${
                    dragActive
                      ? darkMode
                        ? "border-blue-400 bg-blue-900/30"
                        : "border-blue-500 bg-blue-50"
                      : darkMode
                      ? "border-gray-600 bg-gray-700/30"
                      : "border-gray-300 bg-gray-50"
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileInput}
                    className="hidden"
                    id="file-upload"
                  />

                  <label htmlFor="file-upload" className="cursor-pointer block">
                    <Upload
                      className={`w-20 h-20 mx-auto mb-6 ${
                        dragActive ? "text-blue-600" : "text-gray-400"
                      }`}
                    />

                    {file ? (
                      <div
                        className={`inline-block px-6 py-3 rounded-xl ${
                          darkMode
                            ? "bg-blue-600/20 border border-blue-500"
                            : "bg-blue-100 border border-blue-300"
                        }`}
                      >
                        <p
                          className={`text-xl font-bold ${
                            darkMode ? "text-white" : "text-gray-900"
                          }`}
                        >
                          {file.name}
                        </p>
                        <p
                          className={`text-sm ${
                            darkMode ? "text-gray-400" : "text-gray-600"
                          }`}
                        >
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    ) : (
                      <>
                        <p
                          className={`text-2xl font-bold mb-3 ${
                            darkMode ? "text-white" : "text-gray-800"
                          }`}
                        >
                          Drop your PDF here or click to browse
                        </p>
                        <p
                          className={
                            darkMode ? "text-gray-400" : "text-gray-500"
                          }
                        >
                          Supports PDF files up to 50MB
                        </p>
                      </>
                    )}
                  </label>
                </div>

                {error && (
                  <div
                    className={`mt-6 p-4 rounded-xl flex items-center gap-3 ${
                      darkMode
                        ? "bg-red-900/30 border border-red-700"
                        : "bg-red-50 border border-red-200"
                    }`}
                  >
                    <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                    <p className={darkMode ? "text-red-300" : "text-red-800"}>
                      {error}
                    </p>
                  </div>
                )}

                {file && (
                  <div className="mt-8 flex gap-4">
                    <button
                      onClick={handleUpload}
                      disabled={loading}
                      className="flex-1 py-4 px-8 rounded-xl font-bold text-lg bg-linear-to-r from-blue-600 to-purple-600 text-white shadow-lg hover:shadow-xl transition-shadow disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-6 h-6 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <FileText className="w-6 h-6" />
                          Extract Headings
                        </>
                      )}
                    </button>

                    <button
                      onClick={reset}
                      disabled={loading}
                      className={`px-8 py-4 rounded-xl font-bold border-2 transition-colors ${
                        darkMode
                          ? "border-gray-600 text-gray-300 hover:bg-gray-700"
                          : "border-gray-300 text-gray-700 hover:bg-gray-100"
                      } disabled:opacity-50`}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-8">
                {/* Success Banner */}
                <div
                  className={`mb-6 p-5 rounded-xl flex items-center gap-4 ${
                    darkMode
                      ? "bg-green-900/30 border border-green-700"
                      : "bg-green-50 border border-green-200"
                  }`}
                >
                  <CheckCircle2 className="w-7 h-7 text-green-600 shrink-0" />
                  <div className="flex-1">
                    <p
                      className={`font-bold text-lg ${
                        darkMode ? "text-green-300" : "text-green-900"
                      }`}
                    >
                      Successfully processed!
                    </p>
                    <p
                      className={`text-sm ${
                        darkMode ? "text-green-400" : "text-green-700"
                      }`}
                    >
                      Extracted {result.total_headings} headings in{" "}
                      {result.processing_time}s
                    </p>
                  </div>
                  <button
                    onClick={reset}
                    className={`px-6 py-3 rounded-xl font-semibold transition-colors ${
                      darkMode
                        ? "bg-gray-700 border border-green-600 text-green-300 hover:bg-gray-600"
                        : "bg-white border border-green-300 text-green-700 hover:bg-green-50"
                    }`}
                  >
                    Upload New
                  </button>
                </div>

                {/* Stats */}
                {showStats && stats && (
                  <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard
                      label="H1 Headings"
                      value={stats.h1}
                      color="blue"
                      darkMode={darkMode}
                      icon={BarChart3}
                    />
                    <StatCard
                      label="H2 Headings"
                      value={stats.h2}
                      color="indigo"
                      darkMode={darkMode}
                      icon={BarChart3}
                    />
                    <StatCard
                      label="H3 Headings"
                      value={stats.h3}
                      color="purple"
                      darkMode={darkMode}
                      icon={BarChart3}
                    />
                    <StatCard
                      label="Processing"
                      value={`${result.processing_time}s`}
                      color="green"
                      darkMode={darkMode}
                      icon={Clock}
                    />
                  </div>
                )}

                {/* Toolbar */}
                <div
                  className={`mb-6 p-4 rounded-xl flex flex-wrap gap-4 items-center ${
                    darkMode ? "bg-gray-700/50" : "bg-gray-100/50"
                  }`}
                >
                  {/* Search */}
                  <div className="flex-1 min-w-[200px] relative">
                    <Search
                      className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 ${
                        darkMode ? "text-gray-400" : "text-gray-500"
                      }`}
                    />
                    <input
                      type="text"
                      placeholder="Search headings..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full pl-10 pr-10 py-3 rounded-lg border-2 transition-colors ${
                        darkMode
                          ? "bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
                          : "bg-white border-gray-300 text-gray-900 placeholder-gray-500 focus:border-blue-500"
                      }`}
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                      >
                        <X className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                      </button>
                    )}
                  </div>

                  {/* Filters */}
                  <div className="flex gap-2">
                    {["H1", "H2", "H3"].map((level) => (
                      <button
                        key={level}
                        onClick={() => toggleLevel(level)}
                        className={`px-4 py-2 rounded-lg font-bold transition-all ${
                          selectedLevels.includes(level)
                            ? level === "H1"
                              ? "bg-blue-600 text-white"
                              : level === "H2"
                              ? "bg-indigo-600 text-white"
                              : "bg-purple-600 text-white"
                            : darkMode
                            ? "bg-gray-700 text-gray-400"
                            : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <ActionButton
                      onClick={() => setShowStats(!showStats)}
                      darkMode={darkMode}
                      title="Toggle Stats"
                    >
                      {showStats ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </ActionButton>
                    <ActionButton
                      onClick={copyToClipboard}
                      darkMode={darkMode}
                      title="Copy"
                    >
                      <Copy className="w-5 h-5" />
                    </ActionButton>
                    <ActionButton
                      onClick={exportJSON}
                      darkMode={darkMode}
                      title="Export JSON"
                    >
                      <FileJson className="w-5 h-5" />
                    </ActionButton>
                    <ActionButton
                      onClick={exportText}
                      darkMode={darkMode}
                      title="Export TXT"
                    >
                      <Download className="w-5 h-5" />
                    </ActionButton>
                  </div>
                </div>

                {/* Title */}
                <div
                  className={`mb-8 pb-6 border-b-2 ${
                    darkMode ? "border-gray-700" : "border-gray-200"
                  }`}
                >
                  <h2
                    className={`text-4xl font-black mb-2 ${
                      darkMode ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {result.title || "Untitled Document"}
                  </h2>
                  <p className={darkMode ? "text-gray-400" : "text-gray-600"}>
                    {result.filename}
                  </p>
                </div>

                {/* Outline */}
                <div>
                  <h3
                    className={`text-2xl font-bold mb-6 flex items-center gap-3 ${
                      darkMode ? "text-white" : "text-gray-900"
                    }`}
                  >
                    <FileText className="w-6 h-6" />
                    Document Outline
                    <span
                      className={`text-sm font-normal px-3 py-1 rounded-full ${
                        darkMode
                          ? "bg-gray-700 text-gray-300"
                          : "bg-gray-200 text-gray-600"
                      }`}
                    >
                      {filteredHeadings.length}{" "}
                      {filteredHeadings.length === 1 ? "heading" : "headings"}
                    </span>
                  </h3>

                  {filteredHeadings.length > 0 ? (
                    <HeadingList
                      headings={filteredHeadings}
                      darkMode={darkMode}
                    />
                  ) : (
                    <p
                      className={`text-center py-12 italic ${
                        darkMode ? "text-gray-500" : "text-gray-400"
                      }`}
                    >
                      No headings match your filters
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            className={`mt-8 text-center text-sm ${
              darkMode ? "text-gray-500" : "text-gray-600"
            }`}
          >
            <p>Powered by PyMuPDF • FastAPI • React</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Memoized Components
const StatCard = memo(({ label, value, color, darkMode, icon: Icon }) => {
  const colorClasses = {
    blue: darkMode
      ? "bg-blue-900/20 border-blue-700 text-blue-400"
      : "bg-blue-50 border-blue-200 text-blue-600",
    indigo: darkMode
      ? "bg-indigo-900/20 border-indigo-700 text-indigo-400"
      : "bg-indigo-50 border-indigo-200 text-indigo-600",
    purple: darkMode
      ? "bg-purple-900/20 border-purple-700 text-purple-400"
      : "bg-purple-50 border-purple-200 text-purple-600",
    green: darkMode
      ? "bg-green-900/20 border-green-700 text-green-400"
      : "bg-green-50 border-green-200 text-green-600",
  };

  return (
    <div className={`p-4 rounded-xl border ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-5 h-5" />
        <p
          className={`text-sm font-medium ${
            darkMode ? "text-gray-400" : "text-gray-600"
          }`}
        >
          {label}
        </p>
      </div>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
});

const ActionButton = memo(({ onClick, darkMode, title, children }) => (
  <button
    onClick={onClick}
    className={`p-3 rounded-lg transition-transform hover:scale-105 ${
      darkMode ? "bg-gray-700 text-gray-300" : "bg-white text-gray-700"
    }`}
    title={title}
  >
    {children}
  </button>
));

const HeadingList = memo(({ headings, darkMode }) => (
  <div className="space-y-2">
    {headings.map((heading, index) => (
      <HeadingItem
        key={`${heading.page}-${index}`}
        heading={heading}
        darkMode={darkMode}
      />
    ))}
  </div>
));

const HeadingItem = memo(({ heading, darkMode }) => {
  const styles = {
    H1: {
      indent: "",
      text: "text-lg font-bold",
      bgLight: "bg-blue-50 border-blue-500 hover:shadow-lg",
      bgDark: "bg-blue-900/20 border-blue-600 hover:bg-blue-900/30",
      badge: "bg-blue-600",
      dot: "w-3 h-3 bg-blue-600",
    },
    H2: {
      indent: "pl-8",
      text: "text-base font-semibold",
      bgLight: "bg-indigo-50 border-indigo-500 hover:shadow-lg",
      bgDark: "bg-indigo-900/20 border-indigo-600 hover:bg-indigo-900/30",
      badge: "bg-indigo-600",
      dot: "w-2.5 h-2.5 bg-indigo-600",
    },
    H3: {
      indent: "pl-16",
      text: "text-sm font-medium",
      bgLight: "bg-purple-50 border-purple-500 hover:shadow-lg",
      bgDark: "bg-purple-900/20 border-purple-600 hover:bg-purple-900/30",
      badge: "bg-purple-600",
      dot: "w-2 h-2 bg-purple-600",
    },
  };

  const style = styles[heading.level] || styles.H3;

  return (
    <div
      className={`${style.indent} rounded-xl border-l-4 transition-all ${
        darkMode ? style.bgDark : style.bgLight
      }`}
    >
      <div className="p-5 flex items-start gap-4">
        <div className="shrink-0 mt-1.5">
          <div className={`${style.dot} rounded-full`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span
              className={`text-xs font-black px-3 py-1 rounded-lg ${style.badge} text-white`}
            >
              {heading.level}
            </span>
            <span
              className={`text-xs font-medium px-3 py-1 rounded-lg ${
                darkMode
                  ? "bg-gray-700 text-gray-300"
                  : "bg-white text-gray-600 border border-gray-200"
              }`}
            >
              Page {heading.page}
            </span>
          </div>

          <p
            className={`${style.text} wrap-break-word leading-relaxed ${
              darkMode ? "text-gray-200" : "text-gray-800"
            }`}
          >
            {heading.text}
          </p>
        </div>

        <div className="shrink-0">
          <ChevronRight
            className={`w-5 h-5 ${
              darkMode ? "text-gray-500" : "text-gray-400"
            }`}
          />
        </div>
      </div>
    </div>
  );
});

// Utility function
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default App;
