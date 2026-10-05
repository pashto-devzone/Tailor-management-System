import { useEffect, useMemo, useState } from "react";
import {
  defaultMeasurementDetails,
  normalizeMeasurementData,
  prepareMeasurementPayload,
} from "../utils/measurementUtils";

const gallaOptions = ["کالر", "بین", "مغزی گلہ", "ہندی گلہ", "قاسمی گلہ"];
const collarTypes = ["گول کالر", "سیدھا کالر", "چھوٹا کالر"];
const collarSizes = ["1.25 انچ", "1.5 انچ", "1.75 انچ", "2 انچ", "2.25 انچ", "2.5 انچ", "2.75 انچ", "3 انچ"];
const bainTypes = ["گول بین", "سیدھا بین"];

const bainSizes = ["0.5 انچ", "0.75 انچ", "1 انچ", "1.1 انچ", "1.25 انچ", "1.5 انچ"];

const damanOptions = ["گول دامن", "سیدھا دامن"];
const bazuDesigns = ["کنی بازو", "گول بازو", "کف"];
const bazuSizes = ["5 انچ", "5.5 انچ", "5.75 انچ", "6 انچ", "6.25 انچ", "6.5 انچ", "7 انچ"];
const cuffTypes = ["عام کف", "سیدھا کف", "گول کف", "D کف"];
const cuffSizes = ["8 انچ", "8.25 انچ", "8.5 انچ", "8.75 انچ", "9 انچ", "9.25 انچ", "9.5 انچ", "9.75 انچ", "10 انچ"];
const cuffMotaiOptions = ["2.5 انچ", "3 انچ"];
const pataiOptions = ["0.5 انچ", "0.75 انچ", "1 انچ", "1.1 انچ", "1.25 انچ", "1.5 انچ"];
const silaiOptions = [
  "سادہ سلائی",
  "ڈبل سلائی سادہ",
  "سنگل چمک سلائی",
  "ڈبل چمک سلائی",
  "ٹک پہ ٹک سلائی",
  "سنگل زنجیر سلائی",
  "ڈبل زنجیر سلائی",
  "نزدیک سلائی سادہ",
  "نزدیک سلائی چمک",
  "ڈبل CTC",
  "واٹس ایپ",
];
const shalwarOptions = [
  "نارمل شلوار",
  "پٹیالہ شلوار",
  "فل پٹیالہ شلوار",
  "پینٹ شلوار (جیب والی)",
  "پینٹ شلوار (بغیر جیب)",
];

const buildOptionVisibility = (details) => ({
  gala: !details.gala?.type,
  collarSize: !(details.gala?.type === "کالر" && details.gala?.collar_size),
  bainSize: !(details.gala?.type === "بین" && details.gala?.bain_size),
  daaman: !details.daaman?.type,
  pocket: !(
    details.pocket?.front ||
    details.pocket?.side ||
    details.pocket?.front_details ||
    details.pocket?.side_count ||
    details.pocket?.side_details
  ),
  pocketSideCount: !(details.pocket?.side && details.pocket?.side_count),
  baazoo: !details.baazoo?.design,
  baazooSize: !details.baazoo?.size,
  baazooCuffType: !details.baazoo?.cuff_type,
  baazooCuffSize: !details.baazoo?.cuff_size,
  baazooCuffMotai: !details.baazoo?.cuff_motai,
  patai: !details.patai?.type,
  silai: !details.silai?.type,
  shalwar: !details.shalwar?.style,
  shalwarAdditionalPocket: !details.shalwar?.additional_pocket,
  buttonDesign: !details.button_design?.type,
  kaajDesign: !details.kaaj_design?.type,
});

const renderRadioGroup = ({ name, options, selected, onChange, className = "" }) => (
  <div className={`radio-group ${className}`.trim()}>
    {options.map((option) => (
      <label key={option} className={`radio-option ${selected === option ? "selected" : ""}`}>
        <input type="radio" name={name} value={option} checked={selected === option} onChange={(event) => onChange(event.target.value)} />
        <span>{option}</span>
      </label>
    ))}
  </div>
);

const renderSummaryCard = (value, onEdit) => (
  <div className="selected-options-card">
    <div className="selected-option-label">{value || "کوئی انتخاب نہیں"}</div>
    <button type="button" className="option-toggle" onClick={onEdit}>
      تبدیل کریں
    </button>
  </div>
);

const joinSelectedValues = (...values) => {
  const items = values.filter(Boolean);
  return items.length ? items.join(" / ") : "کوئی انتخاب نہیں";
};

const buildPocketSummary = (pocket) =>
  joinSelectedValues(
    pocket.front ? "سامنے پاکٹ" : "",
    pocket.front && pocket.front_details ? `سامنے: ${pocket.front_details}` : "",
    pocket.side ? "سائیڈ پاکٹ" : "",
    pocket.side && pocket.side_count ? `${pocket.side_count} سائیڈ پاکٹ` : "",
    pocket.side && pocket.side_details ? `سائیڈ: ${pocket.side_details}` : "",
  );

export default function MeasurementModal({
  open,
  onClose,
  onSave,
  customer,
  customers = [],
  mode = "add",
  initialData = null,
  loading,
  error,
}) {
  const [formData, setFormData] = useState({
    customer_id: customer?.id || "",
    measurementDetails: { ...defaultMeasurementDetails },
  });
  const [localError, setLocalError] = useState("");
  const [showAllOptions, setShowAllOptions] = useState(() => buildOptionVisibility(defaultMeasurementDetails));

  // Keep these groups expanded until dependent sub-selections are made.
  // This prevents “options disappearing too quickly” after the user picks a parent option.


  useEffect(() => {
    if (!open) return;

    const normalized = normalizeMeasurementData(initialData?.measurements || initialData);
    setFormData({
      customer_id: initialData?.customer_id ?? customer?.id ?? "",
      measurementDetails: normalized,
    });
    setShowAllOptions(buildOptionVisibility(normalized));
    setLocalError("");
  }, [open, initialData, customer]);

  const selectedCustomer = useMemo(
    () => customers.find((item) => String(item.id) === String(formData.customer_id)),
    [customers, formData.customer_id],
  );

  const handleMeasurementChange = (section, key, value) => {
    if (key === null) {
      setFormData((prev) => ({
        ...prev,
        measurementDetails: {
          ...prev.measurementDetails,
          [section]: value,
        },
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      measurementDetails: {
        ...prev.measurementDetails,
        [section]: {
          ...prev.measurementDetails[section],
          [key]: value,
        },
      },
    }));
  };

  const handleCustomerSelect = (value) => {
    setFormData((prev) => ({
      ...prev,
      customer_id: value,
    }));
  };

  const collapseGroup = (group) => {
    setShowAllOptions((prev) => ({ ...prev, [group]: false }));
  };

  const expandGroup = (group) => {
    setShowAllOptions((prev) => ({ ...prev, [group]: true }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.customer_id) {
      setLocalError("براہ کرم ایک گاہک منتخب کریں۔");
      return;
    }

    setLocalError("");

    try {
      await Promise.resolve(
        onSave({
          customer_id: formData.customer_id,
          measurements: prepareMeasurementPayload(formData.measurementDetails),
          comments: formData.measurementDetails.notes || "",
        }),
      );
      onClose?.();
    } catch {
      // Parent component keeps and displays the error state.
    }
  };

  const details = formData.measurementDetails;

  const pocketSummary = buildPocketSummary(details.pocket);

  // Button + Kaaj (required URDU options)
const buttonDesignOptions = ["فینسی رنگ", "سادہ رنگ", "ہک بٹن", "اسپیشل بٹن"];
const kaajDesignOptions = ["ڈبل کاج", "اسٹڈ کاج", "سادہ کاج"];


  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card measurement-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>{mode === "update" ? "میجرمنٹ اپڈیٹ کریں" : "میجرمنٹ شامل کریں"}</h3>
        </div>

        <div className="measurement-modal-body">
          <form id="measurement-form" onSubmit={handleSubmit} className="measurement-modal-form">
            <div className="measurement-form-grid">
              <div className="measurement-column">
                <div className="customer-select-section">
                  <label className="form-field">
                    <span>گاہک منتخب کریں</span>
                    <select value={formData.customer_id} onChange={(event) => handleCustomerSelect(event.target.value)}>
                      <option value="">گاہک منتخب کریں</option>
                      {customers.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.phone})
                        </option>
                      ))}
                    </select>
                  </label>
                  {selectedCustomer ? (
                    <div className="selected-customer-row">
                      <span>نام: {selectedCustomer.name}</span>
                      <span>فون: {selectedCustomer.phone}</span>
                      <span>ID: {selectedCustomer.id}</span>
                    </div>
                  ) : null}
                </div>

                <div className="section-card">
                  <h4>ناپ</h4>
                  <div className="measurement-fields">
                    <label className="form-field">
                      <span>لمبائی</span>
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        placeholder="انچ"
                        value={details.measurements.lambai}
                        onChange={(event) => handleMeasurementChange("measurements", "lambai", event.target.value)}
                      />
                    </label>
                    <label className="form-field">
                      <span>بازو</span>
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        placeholder="انچ"
                        value={details.measurements.bazu}
                        onChange={(event) => handleMeasurementChange("measurements", "bazu", event.target.value)}
                      />
                    </label>
                    <label className="form-field">
                      <span>تیرا</span>
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        placeholder="انچ"
                        value={details.measurements.taira}
                        onChange={(event) => handleMeasurementChange("measurements", "taira", event.target.value)}
                      />
                    </label>
                    <label className="form-field">
                      <span>کالر</span>
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        placeholder="انچ"
                        value={details.measurements.collar}
                        onChange={(event) => handleMeasurementChange("measurements", "collar", event.target.value)}
                      />
                    </label>
                    <label className="form-field">
                      <span>چھاتی</span>
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        placeholder="انچ"
                        value={details.measurements.seena}
                        onChange={(event) => handleMeasurementChange("measurements", "seena", event.target.value)}
                      />
                    </label>
                    <label className="form-field">
                      <span>ہاف چھاتی</span>
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        placeholder="انچ"
                        value={details.measurements.half_seena}
                        onChange={(event) => handleMeasurementChange("measurements", "half_seena", event.target.value)}
                      />
                    </label>
                    <label className="form-field">
                      <span>کمر</span>
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        placeholder="انچ"
                        value={details.measurements.kamar}
                        onChange={(event) => handleMeasurementChange("measurements", "kamar", event.target.value)}
                      />
                    </label>
                    <label className="form-field">
                      <span>دامن</span>
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        placeholder="انچ"
                        value={details.measurements.daaman}
                        onChange={(event) => handleMeasurementChange("measurements", "daaman", event.target.value)}
                      />
                    </label>
                    <label className="form-field">
                      <span>شلوار</span>
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        placeholder="انچ"
                        value={details.measurements.shalwar}
                        onChange={(event) => handleMeasurementChange("measurements", "shalwar", event.target.value)}
                      />
                    </label>
                    <label className="form-field">
                      <span>پانچہ</span>
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        placeholder="انچ"
                        value={details.measurements.pancha}
                        onChange={(event) => handleMeasurementChange("measurements", "pancha", event.target.value)}
                      />
                    </label>
                  </div>
                </div>

                <div className="section-card notes-card">
                  <h4>خصوصی نوٹس</h4>
                  <label className="form-field textarea-field">
                    <textarea
                      rows="6"
                      placeholder="سامنے کھلی رکھنی ہے، ڈھیلا سلائی کرنا ہے، شادی کے لیے ہے..."
                      value={details.notes}
                      onChange={(event) => handleMeasurementChange("notes", null, event.target.value)}
                    />
                  </label>
                </div>
              </div>

              <div className="design-sections-grid">
                <div className="measurement-column design-column">
                  <div className="section-card">
                    <h4>گلہ</h4>
                    {showAllOptions.gala ? (
                      renderRadioGroup({
                        name: "gala_type",
                        options: gallaOptions,
                        selected: details.gala.type,
                        onChange: (value) => {
                          const nextOptions = { ...showAllOptions, gala: false };
                          if (value === "کالر") {
                            nextOptions.collarSize = true;
                            nextOptions.bainSize = true;
                            handleMeasurementChange("gala", "bain_size", "");
                            handleMeasurementChange("gala", "collar_size", "");
                          } else if (value === "بین") {
                            nextOptions.collarSize = true;
                            nextOptions.bainSize = true;
                            handleMeasurementChange("gala", "collar_size", "");
                            handleMeasurementChange("gala", "bain_size", "");
                          } else {
                            nextOptions.collarSize = true;
                            nextOptions.bainSize = true;
                            handleMeasurementChange("gala", "collar_size", "");
                            handleMeasurementChange("gala", "bain_size", "");
                          }
                          setShowAllOptions(nextOptions);
                          handleMeasurementChange("gala", "type", value);
                        },
                      })
                    ) : (
                      renderSummaryCard(details.gala.type, () => expandGroup("gala"))
                    )}

                    <div className={`conditional-section ${details.gala.type === "کالر" ? "show" : ""}`}>
                      <label className="section-subtitle">کالر ٹائپ</label>

                      {showAllOptions.collarSize ? (
                        renderRadioGroup({
                          name: "collar_type",
                          options: collarTypes,
                          selected: details.gala.collar_type,
                          onChange: (value) => {
                            handleMeasurementChange("gala", "collar_type", value);
                            setShowAllOptions((prev) => ({ ...prev, collarSize: true }));
                          },
                        })
                      ) : (
                        renderSummaryCard(details.gala.collar_type, () => expandGroup("collarSize"))
                      )}

                      {(details.gala.collar_type === "گول کالر" || details.gala.collar_type === "سیدھا کالر" || details.gala.collar_type === "چھوٹا کالر") ? (
                        <>
                          <label className="section-subtitle">کالر سائز</label>
                          {showAllOptions.collarSize ? (
                            renderRadioGroup({
                              name: "collar_size",
                              options: collarSizes,
                              selected: details.gala.collar_size,
                              onChange: (value) => {
                                handleMeasurementChange("gala", "collar_size", value);
                                collapseGroup("collarSize");
                              },
                            })
                          ) : (
                            renderSummaryCard(details.gala.collar_size, () => expandGroup("collarSize"))
                          )}
                        </>
                      ) : null}

                    </div>

                    <div className={`conditional-section ${details.gala.type === "بین" ? "show" : ""}`}>
                      <label className="section-subtitle">بین ٹائپ</label>
                      {showAllOptions.bainSize ? (
                        renderRadioGroup({
                          name: "bain_type",
                          options: bainTypes,
                          selected: details.gala.bain_type,
                          onChange: (value) => {
                            handleMeasurementChange("gala", "bain_type", value);
                            // Keep size selector visible until bain size is selected
                            setShowAllOptions((prev) => ({ ...prev, bainSize: true }));
                            // Only collapse when size already exists
                            if (details.gala.bain_size) collapseGroup("bainSize");
                          },
                        })
                      ) : (
                        renderSummaryCard(details.gala.bain_type, () => expandGroup("bainSize"))
                      )}


                      {showAllOptions.bainSize && details.gala.bain_type ? (
                        <></>
                      ) : null}

                      {details.gala.bain_type ? (
                        <>
                          <label className="section-subtitle">بین سائز</label>
                          {showAllOptions.bainSize ? (
                            renderRadioGroup({
                              name: "bain_size",
                              options: bainSizes,
                              selected: details.gala.bain_size,
                              onChange: (value) => {
                                handleMeasurementChange("gala", "bain_size", value);
                                collapseGroup("bainSize");
                              },
                            })
                          ) : (
                            renderSummaryCard(details.gala.bain_size, () => expandGroup("bainSize"))
                          )}
                        </>
                      ) : null}

                    </div>

                  </div>

                  <div className="section-card">
                    <h4>دامن</h4>
                    {showAllOptions.daaman ? (
                      renderRadioGroup({
                        name: "daman",
                        options: damanOptions,
                        selected: details.daaman.type,
                        onChange: (value) => {
                          handleMeasurementChange("daaman", "type", value);
                          collapseGroup("daaman");
                        },
                      })
                    ) : (
                      renderSummaryCard(details.daaman.type, () => expandGroup("daaman"))
                    )}
                  </div>

                  <div className="section-card">
                    <h4>پاکٹ</h4>
                    {showAllOptions.pocket ? (
                      <>
                        <label className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={details.pocket.front}
                            onChange={(event) => {
                              handleMeasurementChange("pocket", "front", event.target.checked);
                              setShowAllOptions((prev) => ({ ...prev, pocket: true }));
                            }}
                          />
                          <span>سامنے پاکٹ</span>
                        </label>
                        {details.pocket.front ? (
                          <label className="form-field">
                            <span>سامنے پاکٹ تفصیل</span>
                            <input
                              type="text"
                              placeholder="تفصیل لکھیں..."
                              value={details.pocket.front_details}
                              onChange={(event) => handleMeasurementChange("pocket", "front_details", event.target.value)}
                            />
                          </label>
                        ) : null}
                        <label className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={details.pocket.side}
                            onChange={(event) => {
                              handleMeasurementChange("pocket", "side", event.target.checked);
                              if (!event.target.checked) {
                                handleMeasurementChange("pocket", "side_count", "");
                                handleMeasurementChange("pocket", "side_details", "");
                              }
                              setShowAllOptions((prev) => ({ ...prev, pocket: true, pocketSideCount: true }));
                            }}
                          />
                          <span>سائیڈ پاکٹ</span>
                        </label>
                        {details.pocket.side ? (
                          <>
                            {showAllOptions.pocketSideCount ? (
                              renderRadioGroup({
                                name: "pocket_side_count",
                                options: ["1 سائیڈ پاکٹ", "2 سائیڈ پاکٹ"],
                                selected: details.pocket.side_count ? `${details.pocket.side_count} سائیڈ پاکٹ` : "",
                                onChange: (value) => {
                                  handleMeasurementChange("pocket", "side_count", value.startsWith("1") ? "1" : "2");
                                  collapseGroup("pocket");
                                  collapseGroup("pocketSideCount");
                                },
                              })
                            ) : (
                              renderSummaryCard(
                                details.pocket.side_count ? `${details.pocket.side_count} سائیڈ پاکٹ` : "",
                                () => expandGroup("pocketSideCount"),
                              )
                            )}
                            <label className="form-field">
                              <span>اضافی تفصیل</span>
                              <input
                                type="text"
                                placeholder="تفصیل لکھیں..."
                                value={details.pocket.side_details}
                                onChange={(event) => handleMeasurementChange("pocket", "side_details", event.target.value)}
                              />
                            </label>
                          </>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <div className="selected-options-card">
                          <div className="selected-option-label">{pocketSummary}</div>
                          <button type="button" className="option-toggle" onClick={() => expandGroup("pocket")}>
                            تبدیل کریں
                          </button>
                        </div>
                        <div className="pocket-summary-note">سامنے، سائیڈ، اور تفصیل کو ایک ہی جگہ سے دوبارہ بدلا جا سکتا ہے۔</div>
                      </>
                    )}
                  </div>

                  {/* Button Design + Kaaj Design directly below side-pocket related options */}
                    <div className="section-card" style={{ marginTop: 12 }}>
                      <h4>بٹن ڈیزائن</h4>
                      <label className="section-subtitle">بٹن ڈیزائن</label>
                      {showAllOptions.buttonDesign ? (
                        renderRadioGroup({
                          name: "button_design",
                          options: buttonDesignOptions,
                          selected: details.button_design.type,
                          onChange: (value) => {
                            handleMeasurementChange("button_design", "type", value);
                            if (value) setShowAllOptions((prev) => ({ ...prev, buttonDesign: false }));
                          },
                        })
                      ) : (
                        renderSummaryCard(
                          details.button_design.type,
                          () => setShowAllOptions((prev) => ({ ...prev, buttonDesign: true }))
                        )
                      )}

                      <label className="form-field" style={{ marginTop: 8 }}>
                        <span>کمنٹس</span>
                        <input
                          type="text"
                          className="text-input-small"
                          placeholder="بٹن ڈیزائن کے لیے کمنٹس"
                          value={details.button_design.comment}
                          onChange={(event) => handleMeasurementChange("button_design", "comment", event.target.value)}
                        />
                      </label>
                    </div>

                    <div className="section-card" style={{ marginTop: 12 }}>
                      <h4>کاج ڈیزائن</h4>
                      <label className="section-subtitle">کاج ڈیزائن</label>
                      {showAllOptions.kaajDesign ? (
                        renderRadioGroup({
                          name: "kaaj_design",
                          options: kaajDesignOptions,
                          selected: details.kaaj_design.type,
                          onChange: (value) => {
                            handleMeasurementChange("kaaj_design", "type", value);
                            if (value) setShowAllOptions((prev) => ({ ...prev, kaajDesign: false }));
                          },
                        })
                      ) : (
                        renderSummaryCard(
                          details.kaaj_design.type,
                          () => setShowAllOptions((prev) => ({ ...prev, kaajDesign: true }))
                        )
                      )}

                      <label className="form-field" style={{ marginTop: 8 }}>
                        <span>کمنٹس</span>
                        <input
                          type="text"
                          className="text-input-small"
                          placeholder="کاج ڈیزائن کے لیے کمنٹس"
                          value={details.kaaj_design.comment}
                          onChange={(event) => handleMeasurementChange("kaaj_design", "comment", event.target.value)}
                        />
                      </label>
                    </div>


                </div>

                <div className="measurement-column design-column">
                  <div className="section-card">
                    <h4>بازو</h4>
                    {showAllOptions.baazoo ? (
                      renderRadioGroup({
                        name: "bazu_design",
                        options: bazuDesigns,
                        selected: details.baazoo.design,
                        onChange: (value) => {
                          handleMeasurementChange("baazoo", "design", value);
                          handleMeasurementChange("baazoo", "size", "");
                          handleMeasurementChange("baazoo", "extra", "");
                          handleMeasurementChange("baazoo", "cuff_type", "");
                          handleMeasurementChange("baazoo", "cuff_size", "");
                          handleMeasurementChange("baazoo", "cuff_extra", "");
                          handleMeasurementChange("baazoo", "cuff_motai", "");
                          handleMeasurementChange("baazoo", "cuff_motai_comment", "");
                          setShowAllOptions((prev) => ({
                            ...prev,
                            baazoo: false,
                            baazooSize: true,
                            baazooCuffType: true,
                            baazooCuffSize: true,
                            baazooCuffMotai: true,
                          }));
                        },
                      })
                    ) : (
                      renderSummaryCard(details.baazoo.design, () => expandGroup("baazoo"))
                    )}

                    {(details.baazoo.design === "کنی بازو" || details.baazoo.design === "گول بازو") && (
                      <div className="conditional-section show">
                        <label className="section-subtitle">سائز</label>
                        {showAllOptions.baazooSize ? (
                          renderRadioGroup({
                            name: "bazu_size",
                            options: bazuSizes,
                            selected: details.baazoo.size,
                            onChange: (value) => {
                              handleMeasurementChange("baazoo", "size", value);
                              collapseGroup("baazooSize");
                            },
                          })
                        ) : (
                          renderSummaryCard(details.baazoo.size, () => expandGroup("baazooSize"))
                        )}
                        <label className="form-field">
                          <span>اضافی سائز</span>
                          <input
                            type="text"
                            placeholder="مزید تفصیل..."
                            value={details.baazoo.extra}
                            onChange={(event) => handleMeasurementChange("baazoo", "extra", event.target.value)}
                          />
                        </label>
                      </div>
                    )}

                    {details.baazoo.design === "کف" && (
                      <div className="conditional-section show">
                        <label className="section-subtitle">کف ٹائپ</label>
                        {showAllOptions.baazooCuffType ? (
                          renderRadioGroup({
                            name: "cuff_type",
                            options: cuffTypes,
                            selected: details.baazoo.cuff_type,
                            onChange: (value) => {
                              handleMeasurementChange("baazoo", "cuff_type", value);
                              setShowAllOptions((prev) => ({
                                ...prev,
                                baazooCuffType: false,
                                baazooCuffSize: true,
                                baazooCuffMotai: true,
                              }));
                            },
                          })
                        ) : (
                          renderSummaryCard(details.baazoo.cuff_type, () => expandGroup("baazooCuffType"))
                        )}

                        <label className="section-subtitle">سائز</label>
                        {showAllOptions.baazooCuffSize ? (
                          renderRadioGroup({
                            name: "cuff_size",
                            options: cuffSizes,
                            selected: details.baazoo.cuff_size,
                            onChange: (value) => {
                              handleMeasurementChange("baazoo", "cuff_size", value);
                              collapseGroup("baazooCuffSize");
                            },
                          })
                        ) : (
                          renderSummaryCard(details.baazoo.cuff_size, () => expandGroup("baazooCuffSize"))
                        )}

                        <label className="form-field">
                          <span>اضافی سائز</span>
                          <input
                            type="text"
                            placeholder="مزید تفصیل..."
                            value={details.baazoo.cuff_extra}
                            onChange={(event) => handleMeasurementChange("baazoo", "cuff_extra", event.target.value)}
                          />
                        </label>

                        <label className="section-subtitle">Cuff Motai (موٹائی)</label>
                        {showAllOptions.baazooCuffMotai ? (
                          renderRadioGroup({
                            name: "cuff_motai",
                            options: cuffMotaiOptions,
                            selected: details.baazoo.cuff_motai,
                            onChange: (value) => {
                              handleMeasurementChange("baazoo", "cuff_motai", value);
                              collapseGroup("baazooCuffMotai");
                            },
                          })
                        ) : (
                          renderSummaryCard(details.baazoo.cuff_motai, () => expandGroup("baazooCuffMotai"))
                        )}

                        <label className="form-field" style={{ marginTop: 8 }}>
                          <span>Cuff Motai کمنٹس</span>
                          <input
                            type="text"
                            className="text-input-small"
                            placeholder="Cuff Motai کے لیے کمنٹس"
                            value={details.baazoo.cuff_motai_comment || ""}
                            onChange={(event) => handleMeasurementChange("baazoo", "cuff_motai_comment", event.target.value)}
                          />
                        </label>
                      </div>
                    )}
                  </div>

                  <div className="section-card">
                    <h4>پٹائی</h4>
                    {showAllOptions.patai ? (
                      renderRadioGroup({
                        name: "pitai",
                        options: pataiOptions,
                        selected: details.patai.type,
                        onChange: (value) => {
                          handleMeasurementChange("patai", "type", value);
                          collapseGroup("patai");
                        },
                      })
                    ) : (
                      renderSummaryCard(details.patai.type, () => expandGroup("patai"))
                    )}

                    {details.patai.type ? (
                        <>
                          <label className="section-subtitle">پٹائی لمبائی</label>
                          <label className="form-field">

                          <input
                            type="number"
                            min="0"
                            step="0.25"
                            placeholder="انچ"
                            value={details.patai.patai_lambai}
                            onChange={(event) => handleMeasurementChange("patai", "patai_lambai", event.target.value)}
                          />
                        </label>
                      </>
                    ) : null}
                  </div>


                  <div className="section-card">
                    <h4>سلائی</h4>
                    {showAllOptions.silai ? (
                      renderRadioGroup({
                        name: "silai",
                        options: silaiOptions,
                        selected: details.silai.type,
                        onChange: (value) => {
                          handleMeasurementChange("silai", "type", value);
                          handleMeasurementChange("silai", "whatsapp_number", "");
                          handleMeasurementChange("silai", "whatsapp_name", "");
                          handleMeasurementChange("silai", "extra_style_design", "");
                          collapseGroup("silai");
                        },
                      })
                    ) : (
                      renderSummaryCard(details.silai.type, () => expandGroup("silai"))
                    )}
                    {details.silai.type === "واٹس ایپ" && (
                      <div className="conditional-section show">
                        <label className="form-field">
                          <span>واٹس ایپ نمبر</span>
                          <input
                            type="text"
                            placeholder="نمبر"
                            value={details.silai.whatsapp_number}
                            onChange={(event) => handleMeasurementChange("silai", "whatsapp_number", event.target.value)}
                          />
                        </label>
                        <label className="form-field">
                          <span>نام</span>
                          <input
                            type="text"
                            placeholder="نام"
                            value={details.silai.whatsapp_name}
                            onChange={(event) => handleMeasurementChange("silai", "whatsapp_name", event.target.value)}
                          />
                        </label>
                        <label className="form-field textarea-field">
                          <span>اضافی اسٹائل / ڈیزائن</span>
                          <textarea
                            rows="3"
                            placeholder="مزید ڈیزائن ہدایات..."
                            value={details.silai.extra_style_design}
                            onChange={(event) => handleMeasurementChange("silai", "extra_style_design", event.target.value)}
                          />
                        </label>
                      </div>
                    )}
                  </div>



                  <div className="section-card">
                    <h4>شلوار</h4>
                    {/* Pocket options -> Side pocket options -> Button Design -> Kaaj Design */}

                    {showAllOptions.shalwar ? (
                      renderRadioGroup({
                        name: "shalwar_style",
                        options: shalwarOptions,
                        selected: details.shalwar.style,
                        onChange: (value) => {
                          handleMeasurementChange("shalwar", "style", value);
                          collapseGroup("shalwar");
                        },
                      })
                    ) : (
                      renderSummaryCard(details.shalwar.style, () => expandGroup("shalwar"))
                    )}
                    <div className="section-subtitle compact-subtitle">شلوار جیب</div>

                    {showAllOptions.shalwarAdditionalPocket ? (
                      renderRadioGroup({
                        name: "additional_pocket",
                        options: ["ہاں", "نہیں"],
                        selected: details.shalwar.additional_pocket,
                        className: "small-radio-group",
                        onChange: (value) => {
                          handleMeasurementChange("shalwar", "additional_pocket", value);
                          collapseGroup("shalwarAdditionalPocket");
                        },
                      })
                    ) : (
                      renderSummaryCard(details.shalwar.additional_pocket, () => expandGroup("shalwarAdditionalPocket"))
                    )}
                  </div>

                </div>

              </div>
            </div>

            {(localError || error) && <p className="message error">{localError || error}</p>}

            <div className="modal-actions measurement-modal-footer">
              <button type="submit" className="button primary" disabled={loading}>
                {loading ? "محفوظ کیا جا رہا ہے..." : "محفوظ کریں"}
              </button>
              <button type="button" className="button secondary" onClick={onClose}>
                منسوخ کریں
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
