import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { createExpense, createSale } from '../services/api';
import {
  Upload,
  CheckCircle2,
  XCircle,
  FileText,
  Scan,
  RefreshCw,
  Camera,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Tag,
} from 'lucide-react';

const ScanBill = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [scanning, setScanning] = useState(false);

  // Extracted Receipt State
  const [detectedData, setDetectedData] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setImagePreview(URL.createObjectURL(file));
      setDetectedData(null);
      setError('');
    }
  };

  const handleSampleReceipt = (type) => {
    setScanning(true);
    setError('');
    setTimeout(() => {
      if (type === 'electricity') {
        setDetectedData({
          merchant: 'State Electricity Board',
          date: new Date().toISOString().split('T')[0],
          amount: 1450,
          type: 'Expense',
          category: 'Electricity',
          paymentMethod: 'UPI',
          description: 'Electricity bill - Store connection',
          confidence: '99.4%',
        });
      } else if (type === 'stock') {
        setDetectedData({
          merchant: 'Sri Meenakshi Traders Ltd',
          date: new Date().toISOString().split('T')[0],
          amount: 8250,
          type: 'Expense',
          category: 'Stock',
          paymentMethod: 'Cash',
          description: 'Weekly retail stock supply',
          confidence: '98.8%',
        });
      } else {
        setDetectedData({
          merchant: 'Counter Sale Bill #409',
          date: new Date().toISOString().split('T')[0],
          amount: 3200,
          type: 'Sale',
          category: 'Stock',
          paymentMethod: 'UPI',
          description: 'Bulk customer order',
          confidence: '97.9%',
        });
      }
      setScanning(false);
    }, 1000);
  };

  // Simulated OCR / Intelligent Receipt Scanning Process
  const handleScanReceipt = () => {
    if (!selectedFile) {
      setError('Please select a receipt image first.');
      return;
    }

    setScanning(true);
    setError('');

    setTimeout(() => {
      const filename = selectedFile.name.toLowerCase();

      let extractedType = 'Expense';
      let extractedCategory = 'Stock';
      let extractedAmount = 2450;
      let extractedMerchant = 'ABC Wholesale Supplies';
      let extractedPayment = 'UPI';

      if (filename.includes('electricity') || filename.includes('current')) {
        extractedCategory = 'Electricity';
        extractedAmount = 1850;
        extractedMerchant = 'Electricity Board';
      } else if (filename.includes('rent')) {
        extractedCategory = 'Rent';
        extractedAmount = 8000;
        extractedMerchant = 'Shop Owner Rent';
      } else if (filename.includes('sale') || filename.includes('customer')) {
        extractedType = 'Sale';
        extractedAmount = 3500;
        extractedMerchant = 'Retail Sale Bill';
      }

      setDetectedData({
        merchant: extractedMerchant,
        date: new Date().toISOString().split('T')[0],
        amount: extractedAmount,
        type: extractedType,
        category: extractedCategory,
        paymentMethod: extractedPayment,
        description: `Scanned: ${extractedMerchant}`,
        confidence: '98.5%',
      });

      setScanning(false);
    }, 1200);
  };

  const handleConfirmAndSave = async () => {
    if (!detectedData || !detectedData.amount || Number(detectedData.amount) <= 0) {
      setError(t('enterAmountError'));
      return;
    }

    try {
      setSaving(true);

      if (detectedData.type === 'Sale') {
        await createSale({
          amount: Number(detectedData.amount),
          paymentMethod: detectedData.paymentMethod || 'Cash',
          description: detectedData.description,
          entryMethod: 'scanned',
        });
      } else {
        await createExpense({
          amount: Number(detectedData.amount),
          category: detectedData.category || 'Stock',
          paymentMethod: detectedData.paymentMethod || 'Cash',
          description: detectedData.description,
          entryMethod: 'scanned',
        });
      }

      navigate('/transactions');
    } catch (err) {
      setError('Failed to save scanned transaction. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDetectedData(null);
    setSelectedFile(null);
    setImagePreview(null);
  };

  return (
    <div className="section-page-container">
      {/* Page Title & Breadcrumb */}
      <div className="page-intro-bar">
        <div>
          <h2 className="section-title">Smart OCR Bill Scanner</h2>
          <p className="section-subtitle">Instantly digitize paper receipts, invoices, and vouchers with automated OCR</p>
        </div>
      </div>

      <div className="scan-layout-grid">
        {/* Dropzone / Upload Panel */}
        <div className="sleek-panel scan-dropzone-panel">
          <div className="panel-header-compact">
            <div className="flex-align-gap">
              <span className="icon-badge-round badge-cyan">
                <Scan size={16} />
              </span>
              <div>
                <h3 className="panel-heading">Receipt Vision Ingestion</h3>
                <span className="panel-subheading">PNG, JPG, or PDF snapshot</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="alert-compact alert-error">
              <XCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {!detectedData && (
            <div className="compact-dropzone-area">
              {imagePreview ? (
                <div className="preview-box-compact">
                  <img src={imagePreview} alt="Receipt preview" className="mini-receipt-thumb" />
                  <div className="preview-actions">
                    <button
                      className="sleek-btn-primary btn-cyan"
                      onClick={handleScanReceipt}
                      disabled={scanning}
                    >
                      {scanning ? (
                        <>
                          <RefreshCw size={15} className="spin" />
                          <span>Extracting Details...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={15} />
                          <span>Process with OCR Vision</span>
                        </>
                      )}
                    </button>
                    <button className="link-clear-thumb" onClick={handleCancel}>
                      Choose different file
                    </button>
                  </div>
                </div>
              ) : (
                <label className="sleek-upload-label">
                  <div className="upload-icon-circle">
                    <Upload size={22} className="text-cyan" />
                  </div>
                  <strong className="upload-prompt-title">Drag & drop receipt or browse files</strong>
                  <span className="upload-prompt-sub">Supports receipts, grocery invoices, electricity slips</span>
                  <span className="btn-browse-file">Browse Image</span>
                  <input type="file" accept="image/*" onChange={handleImageChange} hidden />
                </label>
              )}
            </div>
          )}

          {/* Quick Demo Previews for Testing */}
          {!detectedData && !imagePreview && (
            <div className="demo-samples-bar">
              <span className="demo-label">Quick Demo Receipts:</span>
              <div className="demo-btn-group">
                <button
                  type="button"
                  className="demo-sample-chip"
                  onClick={() => handleSampleReceipt('electricity')}
                >
                  ⚡ Power Bill (₹1,450)
                </button>
                <button
                  type="button"
                  className="demo-sample-chip"
                  onClick={() => handleSampleReceipt('stock')}
                >
                  📦 Wholesale Stock (₹8,250)
                </button>
                <button
                  type="button"
                  className="demo-sample-chip"
                  onClick={() => handleSampleReceipt('sale')}
                >
                  🧾 Counter Sale (₹3,200)
                </button>
              </div>
            </div>
          )}

          {/* OCR RESULT CARD */}
          {detectedData && (
            <div className="ocr-verified-card">
              <div className="ocr-header-strip">
                <div className="flex-align-gap">
                  <CheckCircle2 size={16} className="text-profit" />
                  <strong>OCR Vision Detected Data</strong>
                </div>
                <span className="confidence-pill">AI Confidence: {detectedData.confidence || '98%'}</span>
              </div>

              <div className="ocr-fields-2col">
                <div className="form-group-compact">
                  <label className="field-label-compact">Merchant / Biller</label>
                  <input
                    type="text"
                    value={detectedData.merchant}
                    onChange={(e) => setDetectedData({ ...detectedData, merchant: e.target.value })}
                    className="sleek-text-input"
                  />
                </div>

                <div className="form-group-compact">
                  <label className="field-label-compact">Transaction Type</label>
                  <select
                    value={detectedData.type}
                    onChange={(e) => setDetectedData({ ...detectedData, type: e.target.value })}
                    className="sleek-select-input"
                  >
                    <option value="Expense">Expense (Outflow)</option>
                    <option value="Sale">Sale (Inflow)</option>
                  </select>
                </div>

                <div className="form-group-compact">
                  <label className="field-label-compact">Amount (₹)</label>
                  <input
                    type="number"
                    value={detectedData.amount}
                    onChange={(e) => setDetectedData({ ...detectedData, amount: e.target.value })}
                    className="sleek-text-input font-bold"
                  />
                </div>

                {detectedData.type === 'Expense' ? (
                  <div className="form-group-compact">
                    <label className="field-label-compact">Category</label>
                    <select
                      value={detectedData.category}
                      onChange={(e) => setDetectedData({ ...detectedData, category: e.target.value })}
                      className="sleek-select-input"
                    >
                      <option value="Stock">Stock</option>
                      <option value="Rent">Rent</option>
                      <option value="Electricity">Electricity</option>
                      <option value="Salary">Staff Salary</option>
                      <option value="Transport">Transport</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                ) : (
                  <div className="form-group-compact">
                    <label className="field-label-compact">Payment Method</label>
                    <select
                      value={detectedData.paymentMethod}
                      onChange={(e) => setDetectedData({ ...detectedData, paymentMethod: e.target.value })}
                      className="sleek-select-input"
                    >
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="Card">Card</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="ocr-actions-strip">
                <button
                  className="sleek-btn-primary btn-emerald"
                  onClick={handleConfirmAndSave}
                  disabled={saving}
                >
                  <CheckCircle2 size={15} />
                  <span>{saving ? 'Saving...' : 'Confirm & Save Transaction'}</span>
                </button>
                <button className="sleek-btn-secondary" onClick={handleCancel}>
                  <XCircle size={15} />
                  <span>Discard / Re-scan</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScanBill;
