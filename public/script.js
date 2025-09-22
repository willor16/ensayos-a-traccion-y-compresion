const firebaseConfig = {
    apiKey: "AIzaSyCXOd-zp2wjey667nVwyPYV7MPPHEmUo2g",
    authDomain: "ensayos-a-compresion.firebaseapp.com",
    databaseURL: "https://ensayos-a-compresion-default-rtdb.firebaseio.com",
    projectId: "ensayos-a-compresion",
    storageBucket: "ensayos-a-compresion.firebasestorage.app",
    messagingSenderId: "326903935230",
    appId: "1:326903935230:web:ba3ed7cdf5a9f151303S5af"
};

let database;
let currentChart;
let currentData = [];
let rawReadings = [];
let currentPracticeInfo = null;
let probetaArea = 0;
let currentTestType = null;
let modalAction = '';
let probetaLM = 0;

try {
    firebase.initializeApp(firebaseConfig);
    database = firebase.database();
} catch (error) {
    console.error("Error al inicializar Firebase:", error);
    alert("Error al inicializar Firebase.");
}

function showLightbox(title, message, callback) {
    const existingLightbox = document.querySelector('.lightbox-overlay');
    if (existingLightbox) existingLightbox.remove();

    const overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    const box = document.createElement('div');
    box.className = 'lightbox-box';
    const titleH2 = document.createElement('h2');
    titleH2.innerHTML = `<span>⚠️</span> ${title}`;
    const messageP = document.createElement('p');
    messageP.innerHTML = message;
    const okButton = document.createElement('button');
    okButton.textContent = 'Entendido';

    const closeLightbox = () => {
        document.body.removeChild(overlay);
        if (callback) callback();
    };

    okButton.addEventListener('click', closeLightbox);
    box.appendChild(titleH2);
    box.appendChild(messageP);
    box.appendChild(okButton);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    okButton.focus();
}

const stressStrainChartCtx = document.getElementById('stressStrainChart')?.getContext('2d');
const youngModulusSpan = document.getElementById('youngModulus');
const yieldStrengthSpan = document.getElementById('yieldStrength');
const ultimateStrengthSpan = document.getElementById('ultimateStrength');
const maxDeformationSpan = document.getElementById('maxDeformation');
const toughnessEnergySpan = document.getElementById('toughnessEnergy');
const clearGraphBtn = document.getElementById('clearGraph');
const exportPdfBtn = document.getElementById('exportPdf');
const saveRecordBtn = document.getElementById('saveRecord');
const exportExcelBtn = document.getElementById('exportExcel');
const subgraphButtons = document.querySelectorAll('.subgraph-buttons button');
const viewFullGraphBtn = document.getElementById('viewFullGraph');
const navButtons = document.querySelectorAll('.nav-button');
const sections = document.querySelectorAll('.section');
const saveModal = document.getElementById('saveModal');
const closeModalBtn = document.querySelector('.close-button');
const practiceNameInput = document.getElementById('practiceName');
const practiceDescriptionInput = document.getElementById('practiceDescription');
const wordCountDiv = document.getElementById('wordCount');
const operatorsContainer = document.getElementById('operatorsContainer');
let addOperatorBtn = document.getElementById('addOperator');
const confirmSaveBtn = document.getElementById('confirmSave');
const searchTermInput = document.getElementById('searchTerm');
const searchButton = document.getElementById('searchButton');
const practiceListUl = document.getElementById('practiceList');
const probetaTipoSelect = document.getElementById('probetaTipo');
const rectangularDimsDiv = document.getElementById('rectangularDims');
const cilindricaDimsDiv = document.getElementById('cilindricaDims');
const probetaBaseInput = document.getElementById('probetaBase');
const probetaAlturaInput = document.getElementById('probetaAltura');
const probetaRadioInput = document.getElementById('probetaRadio');
const probetaLongitudInicialInput = document.getElementById('probetaLongitudInicial');
const probetaLongitudDespreciarInput = document.getElementById('probetaLongitudDespreciar');
const areaTransversalResultSpan = document.getElementById('areaTransversalResult');
const loadFromSensorBtn = document.getElementById('loadFromSensor');
const testTypeSelector = document.getElementById('testTypeSelector');
const practiceInfoDisplay = document.getElementById('practiceInfoDisplay');
const infoPracticeName = document.getElementById('infoPracticeName');
const infoOperatorsList = document.getElementById('infoOperatorsList');
const infoPracticeDescription = document.getElementById('infoPracticeDescription');
const infoTestType = document.getElementById('infoTestType');
const infoProbetaDetails = document.getElementById('infoProbetaDetails');


function handleTipoChange() {
    if (!probetaTipoSelect) return;
    const selectedType = probetaTipoSelect.value;
    rectangularDimsDiv.style.display = selectedType === 'rectangular' ? 'block' : 'none';
    cilindricaDimsDiv.style.display = selectedType === 'cilindrica' ? 'block' : 'none';
    calculateProbetaProperties();
}

function calculateProbetaProperties() {
    if (!probetaTipoSelect) return;
    const tipo = probetaTipoSelect.value;
    let area = 0;
    if (tipo === 'rectangular') {
        area = (parseFloat(probetaBaseInput.value) || 0) * (parseFloat(probetaAlturaInput.value) || 0);
    } else {
        area = Math.PI * Math.pow(parseFloat(probetaRadioInput.value) || 0, 2);
    }
    probetaArea = area;
    if (areaTransversalResultSpan) areaTransversalResultSpan.textContent = area > 0 ? area.toFixed(4) : 'N/A';
}

function drawChart(data, title = 'Curva Esfuerzo-Deformación') {
    if (!stressStrainChartCtx) return;
    if (currentChart) currentChart.destroy();
    const chartData = data.map(d => ({ x: d.strain, y: d.stress }));
    currentChart = new Chart(stressStrainChartCtx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Esfuerzo (MPa)', data: chartData, borderColor: 'var(--accent-color)',
                backgroundColor: 'rgba(0, 188, 212, 0.2)', borderWidth: 2, pointRadius: 0,
                fill: true, tension: 0.4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index',
            },
            plugins: {
                title: { display: true, text: title, color: 'var(--text-color)', font: { size: 18 } },
                tooltip: { callbacks: { label: ctx => `Esfuerzo: ${ctx.parsed.y.toFixed(2)} MPa, Deformación: ${ctx.parsed.x.toFixed(4)}` } }
            },
            scales: {
                x: { type: 'linear', beginAtZero: true, title: { display: true, text: 'Deformación (ε)', color: 'var(--text-color)' }, grid: { color: 'var(--border-color)' }, ticks: { color: 'var(--text-color)' } },
                y: { type: 'linear', beginAtZero: true, title: { display: true, text: 'Esfuerzo (σ) [MPa]', color: 'var(--text-color)' }, grid: { color: 'var(--border-color)' }, ticks: { color: 'var(--text-color)' } }
            }
        }
    });
}

function calculateAndDisplayParameters(data) {
    if (data.length < 2) { resetParameters(); return; }
    let youngModulus = 'N/A';
    const initialPoints = data.filter(d => d.strain > 0 && d.strain <= 0.003);
    if (initialPoints.length >= 2) {
        const first = initialPoints[0], last = initialPoints[initialPoints.length - 1];
        if (last.strain - first.strain > 0) youngModulus = ((last.stress - first.stress) / (last.strain - first.strain)).toFixed(2) + ' MPa';
    }
    let yieldStrength = 'N/A', yieldIndex = -1;
    for (let i = 5; i < data.length; i++) {
        const prevStrain = data[i - 2].strain, currStrain = data[i - 1].strain, nextStrain = data[i].strain;
        if (currStrain - prevStrain > 0 && nextStrain - currStrain > 0) {
            const prevSlope = (data[i - 1].stress - data[i - 2].stress) / (currStrain - prevStrain);
            const currSlope = (data[i].stress - data[i - 1].stress) / (nextStrain - currStrain);
            if (currSlope > 0 && prevSlope > 0 && currSlope < prevSlope * 0.65) { yieldIndex = i; break; }
        }
    }
    if (yieldIndex === -1 && data.length > 10) yieldIndex = Math.floor(data.length * 0.15);
    if (yieldIndex !== -1) yieldStrength = data[yieldIndex].stress.toFixed(2) + ' MPa';
    const ultimatePoint = data.reduce((max, p) => p.stress > max.stress ? p : max, data[0]);
    const ultimateStrength = ultimatePoint.stress.toFixed(2) + ' MPa';
    const maxDeformation = data[data.length - 1].strain.toFixed(4);
    let toughness = 0;
    for (let i = 1; i < data.length; i++) toughness += ((data[i].stress + data[i - 1].stress) / 2) * (data[i].strain - data[i - 1].strain);
    youngModulusSpan.textContent = youngModulus;
    yieldStrengthSpan.textContent = yieldStrength;
    ultimateStrengthSpan.textContent = ultimateStrength;
    maxDeformationSpan.textContent = maxDeformation;
    toughnessEnergySpan.textContent = toughness.toFixed(2) + ' MJ/m³';
}

function resetParameters() {
    youngModulusSpan.textContent = 'N/A'; yieldStrengthSpan.textContent = 'N/A'; ultimateStrengthSpan.textContent = 'N/A';
    maxDeformationSpan.textContent = 'N/A'; toughnessEnergySpan.textContent = 'N/A';
}

function displaySubgraph(zoneType) {
    if (currentData.length < 2) { showLightbox('Datos Insuficientes', 'No hay suficientes datos cargados para mostrar una sub-zona.'); return; }
    let subGraphData = [], title = '';
    const ultimatePoint = currentData.reduce((max, p) => p.stress > max.stress ? p : max, currentData[0]);
    const ultimateIndex = currentData.indexOf(ultimatePoint);
    let yieldIndex = -1;
    for (let i = 5; i < ultimateIndex; i++) {
        const prevSlope = (currentData[i - 1].stress - currentData[i - 2].stress) / (currentData[i - 1].strain - currentData[i - 2].strain);
        const currSlope = (currentData[i].stress - currentData[i - 1].stress) / (currentData[i].strain - currentData[i - 1].strain);
        if (currSlope > 0 && prevSlope > 0 && currSlope < prevSlope * 0.65) { yieldIndex = i; break; }
    }
    if (yieldIndex === -1) yieldIndex = Math.floor(currentData.length * 0.15);

    switch (zoneType) {
        case 'elastica': subGraphData = currentData.slice(0, yieldIndex + 1); title = 'Zona Elástica'; break;
        case 'plastica': subGraphData = currentData.slice(yieldIndex); title = 'Zona Plástica'; break;
        case 'endurecimiento': subGraphData = currentData.slice(yieldIndex, ultimateIndex + 1); title = 'Zona de Endurecimiento'; break;
        case 'cedencia':
            const cedenciaEndIndex = Math.min(yieldIndex + Math.floor(currentData.length * 0.1), currentData.length - 1);
            subGraphData = currentData.slice(yieldIndex, cedenciaEndIndex + 1); title = 'Zona de Cedencia'; break;
    }
    if (subGraphData.length > 1) drawChart(subGraphData, title);
    else showLightbox('Datos Insuficientes', `No hay suficientes puntos para aislar la '${title}'.`);
}

function clearGraph() {
    if (currentChart) currentChart.destroy();
    resetParameters();
    currentData = [];
    rawReadings = [];
    if(exportExcelBtn) exportExcelBtn.disabled = true;
    currentPracticeInfo = null;
    probetaLM = 0;
    if (practiceInfoDisplay) practiceInfoDisplay.style.display = 'none';
    drawChart([]);
}

async function generatePdfWithInfo(info) {
    if (!window.jspdf || !window.html2canvas) { showLightbox('Error', 'Las librerías para PDF no están cargadas.'); return; }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

    if (typeof doc.autoTable !== 'function') {
        showLightbox('Error de Librería', 'El plugin jsPDF-AutoTable no se cargó correctamente. Revisa la etiqueta &lt;script&gt; en tu HTML.');
        return;
    }

    const pdfWidth = doc.internal.pageSize.getWidth(), pdfHeight = doc.internal.pageSize.getHeight(), margin = 15, contentWidth = pdfWidth - (margin * 2);
    
    const originalColors = { borderColor: currentChart.data.datasets[0].borderColor, backgroundColor: currentChart.data.datasets[0].backgroundColor, titleColor: currentChart.options.plugins.title.color, scaleColor: currentChart.options.scales.x.title.color, gridColor: currentChart.options.scales.x.grid.color, ticksColor: currentChart.options.scales.x.ticks.color };
    Object.assign(currentChart.data.datasets[0], { borderColor: '#000000', backgroundColor: 'rgba(0,0,0,0.1)' });
    Object.assign(currentChart.options.plugins.title, { color: '#000000' });
    ['x', 'y'].forEach(axis => { Object.assign(currentChart.options.scales[axis].title, { color: '#000000' }); Object.assign(currentChart.options.scales[axis].grid, { color: '#cccccc' }); Object.assign(currentChart.options.scales[axis].ticks, { color: '#000000' }); });
    currentChart.update();
    const canvas = document.getElementById('stressStrainChart');
    const canvasImage = await html2canvas(canvas, { scale: 2, backgroundColor: '#ffffff' });
    const imgData = canvasImage.toDataURL('image/png');
    Object.assign(currentChart.data.datasets[0], { borderColor: originalColors.borderColor, backgroundColor: originalColors.backgroundColor });
    Object.assign(currentChart.options.plugins.title, { color: originalColors.titleColor });
    ['x', 'y'].forEach(axis => { Object.assign(currentChart.options.scales[axis].title, { color: originalColors.scaleColor }); Object.assign(currentChart.options.scales[axis].grid, { color: originalColors.gridColor }); Object.assign(currentChart.options.scales[axis].ticks, { color: originalColors.ticksColor }); });
    currentChart.update();

    doc.setTextColor('#000000'); doc.setFontSize(18); doc.text("Informe de Ensayo: Esfuerzo-Deformación", pdfWidth / 2, 20, { align: 'center' });
    let yOffset = 35;
    doc.setFontSize(12);
    doc.text(`Nombre de la Práctica: ${info.practiceName}`, margin, yOffset); yOffset += 7;
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, margin, yOffset); yOffset += 10;
    doc.text("Operadores:", margin, yOffset); yOffset += 7;
    info.operators.forEach(op => { doc.text(`- ${op}`, margin + 5, yOffset); yOffset += 7; });
    yOffset += 5;
    doc.setFontSize(14); doc.text("Datos del Ensayo y Probeta", margin, yOffset); yOffset += 7;
    doc.setFontSize(12);
    doc.text(`Tipo de Ensayo: ${info.testType === 'traccion' ? 'Tracción' : 'Compresión'}`, margin, yOffset); yOffset += 7;
    if (info.probeta) {
        doc.text(`Tipo de Probeta: ${info.probeta.tipo}`, margin, yOffset); yOffset += 7;
        doc.text(`Dimensiones: ${info.probeta.tipo === 'rectangular' ? `Base ${info.probeta.base} mm, Altura ${info.probeta.altura} mm` : `Radio ${info.probeta.radio} mm`}`, margin, yOffset); yOffset += 7;
        doc.text(`Longitud Inicial (L₀): ${info.probeta.longitudInicial.toFixed(2)} mm`, margin, yOffset); yOffset += 7;
        doc.text(`Área Transversal: ${info.probeta.area.toFixed(4)} mm²`, margin, yOffset); yOffset += 10;
    }
    doc.text("Descripción:", margin, yOffset); yOffset += 7;
    const splitDescription = doc.splitTextToSize(info.practiceDescription || 'N/A', contentWidth);
    doc.text(splitDescription, margin, yOffset); yOffset += (splitDescription.length * 5) + 5;
    const imgHeight = (canvasImage.height * contentWidth) / canvasImage.width;
    if (yOffset + imgHeight > pdfHeight - margin) { doc.addPage(); yOffset = margin; }
    doc.addImage(imgData, 'PNG', margin, yOffset, contentWidth, imgHeight); yOffset += imgHeight + 10;
    if (yOffset > pdfHeight - 45) { doc.addPage(); yOffset = margin; }
    doc.setFontSize(14); doc.text("Parámetros Calculados", pdfWidth / 2, yOffset, { align: 'center' }); yOffset += 10;
    doc.setFontSize(12);
    doc.text(`Módulo de Young: ${youngModulusSpan?.textContent}`, margin, yOffset); yOffset += 7;
    doc.text(`Límite Elástico: ${yieldStrengthSpan?.textContent}`, margin, yOffset); yOffset += 7;
    doc.text(`Esfuerzo Último: ${ultimateStrengthSpan?.textContent}`, margin, yOffset); yOffset += 7;
    doc.text(`Deformación Máxima: ${maxDeformationSpan?.textContent}`, margin, yOffset); yOffset += 7;
    doc.text(`Tenacidad: ${toughnessEnergySpan?.textContent}`, margin, yOffset);
    
    if (rawReadings && rawReadings.length > 0) {
        doc.addPage();
        doc.setFontSize(16);
        doc.text("Tabla de Datos Crudos del Sensor", pdfWidth / 2, 20, { align: 'center' });

        const tableHead = [['Distancia (mm)', 'Fuerza (lbf)']];
        const tableBody = rawReadings.map(reading => [
            (reading.dist_mm || 0).toFixed(4),
            (reading.fuerza_lbf || 0).toFixed(4)
        ]);

        doc.autoTable({
            head: tableHead,
            body: tableBody,
            startY: 30,
            theme: 'grid',
            styles: { halign: 'center' },
            headStyles: { fillColor: [41, 128, 185], textColor: 255 }
        });
    }

    doc.save(`${info.practiceName.replace(/\s+/g, '_')}.pdf`);
}

function showSaveModal() {
    if (!saveModal) return;
    saveModal.style.display = 'flex';
    practiceNameInput.value = '';
    practiceDescriptionInput.value = '';
    wordCountDiv.textContent = '0 / 500 palabras';
    operatorsContainer.innerHTML = `<label for="operatorInput1">Registro Académico:</label><input type="text" id="operatorInput1" name="operator" class="operator-input" placeholder="Ej: No. de Carnet"><button id="addOperator" type="button">+</button>`;
    addOperatorBtn = document.getElementById('addOperator');
    if (addOperatorBtn) addOperatorBtn.addEventListener('click', addOperatorField);
}

function hideSaveModal() { if (saveModal) saveModal.style.display = 'none'; }

function addOperatorField() {
    const newInput = document.createElement('input');
    newInput.type = 'text';
    newInput.className = 'operator-input';
    newInput.name = 'operator';
    newInput.placeholder = 'Ej: No. de Carnet';
    operatorsContainer.insertBefore(newInput, addOperatorBtn);
}

async function saveRecordToFirebase(data) {
    if (!database) { showLightbox('Error de Conexión', 'No se pudo conectar con la base de datos.'); return; }
    const probetaData = { tipo: probetaTipoSelect.value, base: parseFloat(probetaBaseInput.value) || 0, altura: parseFloat(probetaAlturaInput.value) || 0, radio: parseFloat(probetaRadioInput.value) || 0, longitudInicial: probetaLM, area: probetaArea };
    
    const record = { 
        date: new Date().toISOString().slice(0, 10), 
        practiceName: data.practiceName, 
        practiceDescription: data.practiceDescription, 
        operators: data.operators, 
        testType: currentTestType, 
        probeta: probetaData, 
        curveData: JSON.stringify(currentData),
        rawSensorData: JSON.stringify(rawReadings)
    };

    try {
        await database.ref('practices').push(record);
        showLightbox('Éxito', 'El registro se ha guardado correctamente.');
        hideSaveModal();
        loadPracticeHistory();
    } catch (error) { showLightbox('Error al Guardar', 'No se pudo guardar el registro.'); }
}

function loadPracticeHistory() {
    if (!practiceListUl || !database) return;
    database.ref('practices').on('value', (snapshot) => {
        practiceListUl.innerHTML = '';
        const practices = snapshot.val();
        if (practices) {
            Object.keys(practices).reverse().forEach(key => {
                const p = practices[key];
                const li = document.createElement('li');
                li.innerHTML = `<span><strong>${p.practiceName}</strong> - ${p.date}</span><button data-key="${key}">Cargar</button>`;
                practiceListUl.appendChild(li);
            });
        } else { practiceListUl.innerHTML = '<li>No hay registros guardados.</li>'; }
    });
}

function loadSpecificPractice(key) {
    if (!database) { showLightbox("Error de Conexión", "No se pudo conectar."); return; }
    database.ref('practices/' + key).once('value', (snapshot) => {
        const practice = snapshot.val();
        if (practice && practice.curveData) {
            currentPracticeInfo = practice;
            currentData = JSON.parse(practice.curveData);
            
            if (practice.rawSensorData) {
                rawReadings = JSON.parse(practice.rawSensorData);
                if(exportExcelBtn) exportExcelBtn.disabled = false;
            } else {
                rawReadings = [];
                if(exportExcelBtn) exportExcelBtn.disabled = true;
            }

            infoPracticeName.textContent = practice.practiceName;
            infoPracticeDescription.textContent = practice.practiceDescription || 'N/A';
            infoOperatorsList.innerHTML = '';
            if (practice.operators && practice.operators.length > 0) practice.operators.forEach(op => { const li = document.createElement('li'); li.textContent = op; infoOperatorsList.appendChild(li); });
            else { const li = document.createElement('li'); li.textContent = 'N/A'; infoOperatorsList.appendChild(li); }
            infoTestType.textContent = practice.testType === 'traccion' ? 'Tracción' : 'Compresión';
            if (practice.probeta) {
                const p = practice.probeta;
                let details = `Tipo: ${p.tipo}, L₀: ${p.longitudInicial.toFixed(2)} mm, Área: ${p.area.toFixed(2)} mm²`;
                if (p.tipo === 'rectangular') details += ` (Base: ${p.base} mm, Altura: ${p.altura} mm)`;
                else details += ` (Radio: ${p.radio} mm)`;
                infoProbetaDetails.textContent = details;
            } else infoProbetaDetails.textContent = "N/A";
            practiceInfoDisplay.style.display = 'block';
            drawChart(currentData, `Historial: ${practice.practiceName}`);
            calculateAndDisplayParameters(currentData);
            switchSection('grafica');
        } else showLightbox('Error', 'Registro no encontrado o corrupto.');
    });
}

function searchPractices() {
    if (!searchTermInput || !practiceListUl) return;
    const term = searchTermInput.value.toLowerCase();
    practiceListUl.querySelectorAll('li').forEach(item => { item.style.display = item.textContent.toLowerCase().includes(term) ? '' : 'none'; });
}

function switchSection(sectionId) {
    sections.forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId)?.classList.add('active');
    navButtons.forEach(b => b.classList.toggle('active', b.dataset.section === sectionId));
    if (sectionId === 'historial') loadPracticeHistory();
}

/**
 * Aplica un filtro de media móvil a un conjunto de datos.
 * @param {Array} data - El array de puntos {strain, stress}.
 * @param {number} windowSize - El tamaño de la ventana para el promedio.
 * @returns {Array} - El array de datos suavizados.
 */
function applyMovingAverage(data, windowSize) {
    if (windowSize < 2) return data;
    const smoothed = [];
    for (let i = 0; i < data.length; i++) {
        const start = Math.max(0, i - Math.floor(windowSize / 2));
        const end = Math.min(data.length, i + Math.floor(windowSize / 2) + 1);
        const windowSlice = data.slice(start, end);
        const avgStress = windowSlice.reduce((sum, p) => sum + p.stress, 0) / windowSlice.length;
        smoothed.push({ strain: data[i].strain, stress: avgStress });
    }
    return smoothed;
}


async function loadLatestSensorData(isAutoLoad = false) {
    if (!isAutoLoad) {
        clearGraph();
    }
    
    if (!currentTestType) {
        showLightbox("Acción Requerida", "Selecciona un <b>tipo de ensayo</b> (Compresión o Tracción).", () => switchSection('grafica'));
        return;
    }
    if (probetaArea <= 0) {
        showLightbox("Faltan Datos", "Ve a <b>Datos de Probeta</b> e ingresa las <b>dimensiones</b>.", () => switchSection('datos-probeta'));
        return;
    }

    loadFromSensorBtn.disabled = true;
    loadFromSensorBtn.textContent = 'Cargando...';
    try {
        const snapshot = await database.ref('datos').once('value');
        if (!snapshot.exists() || !snapshot.val().muestras) {
            showLightbox("Sin Datos", "No se encontraron muestras en Firebase.");
            return;
        }
        const readings = Object.values(snapshot.val().muestras);
        rawReadings = readings;
        if(exportExcelBtn) exportExcelBtn.disabled = false;
        
        if (readings.length < 2) {
            showLightbox("Pocos Datos", "Se necesitan al menos 2 muestras para generar una gráfica.");
            return;
        }

        const Ld = parseFloat(probetaLongitudDespreciarInput.value) || 0;
        
        const primeraLectura = readings[0];
        probetaLM = (primeraLectura.dist_mm - Ld);
        probetaLongitudInicialInput.value = probetaLM.toFixed(2);


        const LBF_TO_NEWTON = 4.44822;
        let processedData = readings.map(m => {
            const stressMPa = probetaArea > 0 ? (((m.fuerza_lbf || 0) * LBF_TO_NEWTON) / probetaArea) : 0;
            const longitudActual = m.dist_mm - Ld;
            let strain = (currentTestType === 'traccion') ? (longitudActual - probetaLM) / probetaLM : (probetaLM - longitudActual) / probetaLM;
            return { strain, stress: stressMPa };
        });
        
        processedData.sort((a, b) => a.strain - b.strain);

        // --- ▼▼▼ INICIO DE LA NUEVA LÓGICA DE FILTRADO ADAPTATIVO ▼▼▼ ---

        let finalDataForChart = [];
        const MINIMUM_POINTS_FOR_FILTERING = 10; // Umbral de puntos para considerar un filtro válido

        // CASO 3: Intento con el filtro agresivo (envolvente) primero. Es el ideal para datos limpios.
        const envelopeData = [];
        let maxStressEncountered = 0;
        for (const point of processedData) {
            if (point.stress >= maxStressEncountered) {
                envelopeData.push(point);
                maxStressEncountered = point.stress;
            }
        }

        if (envelopeData.length >= MINIMUM_POINTS_FOR_FILTERING) {
            console.log("Estrategia de filtrado: Envolvente Agresiva (Caso 3). Datos de buena calidad.");
            finalDataForChart = envelopeData;
        } else {
            // CASO 2: Si el filtro agresivo falló, se prueba un suavizado suave (media móvil).
            const MOVING_AVG_WINDOW = 5; // Ventana pequeña para no distorsionar la curva
            const smoothedData = applyMovingAverage(processedData, MOVING_AVG_WINDOW);
            
            if (smoothedData.length >= MINIMUM_POINTS_FOR_FILTERING) {
                console.log("Estrategia de filtrado: Media Móvil Suave (Caso 2). Se detectó ruido en los datos.");
                finalDataForChart = smoothedData;
            } else {
                // CASO 1: Como último recurso, se usan los datos procesados sin ningún filtro.
                console.log("Estrategia de filtrado: Sin filtro (Caso 1). Se graficarán los datos crudos procesados.");
                finalDataForChart = processedData;
            }
        }

        // Se aplica un filtro final para asegurar que no haya deformación negativa antes de asignar los datos.
        currentData = finalDataForChart.filter(p => p.strain >= 0);

        // --- ▲▲▲ FIN DE LA NUEVA LÓGICA DE FILTRADO ADAPTATIVO ▲▲▲ ---

        if (currentData.length < 2) {
            // Este mensaje ahora es más específico, aparece si incluso sin filtros no hay datos válidos.
            showLightbox("Datos Inconsistentes", "Después de procesar, no hay suficientes datos válidos para la gráfica. Revisa las lecturas del sensor.");
            return;
        }

        drawChart(currentData, 'Ensayo Actual desde Sensor');
        calculateAndDisplayParameters(currentData);
        if (!isAutoLoad) showLightbox('Éxito', 'Datos cargados y procesados.');
        switchSection('grafica');
    } catch (error) {
        console.error("Error al cargar datos:", error);
        showLightbox("Error de Carga", "Ocurrió un error al cargar los datos desde Firebase.");
    } finally {
        loadFromSensorBtn.disabled = false;
        loadFromSensorBtn.textContent = 'Cargar Últimos Datos del Sensor';
    }
}


function exportToExcel() {
    if (rawReadings.length === 0) {
        showLightbox('Sin Datos', 'No hay datos crudos para exportar. Carga un ensayo desde el sensor o el historial.');
        return;
    }

    let csvContent = "\uFEFFDistancia (mm);Fuerza (lbf)\r\n";
    rawReadings.forEach(row => {
        csvContent += `${row.dist_mm};${row.fuerza_lbf}\r\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "datos_ensayo.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = `
        .lightbox-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 1000; }
        .lightbox-box { background: #2c2c2c; padding: 25px; border-radius: 10px; text-align: center; max-width: 90%; width: 400px; box-shadow: 0 5px 15px rgba(0,0,0,0.5); border-top: 4px solid var(--accent-color); }
        .lightbox-box h2 { margin-top: 0; color: #fff; display: flex; align-items: center; justify-content: center; gap: 10px; }
        .lightbox-box h2 span { color: var(--accent-color); font-size: 1.5em; }
        .lightbox-box p { color: #ccc; line-height: 1.6; }
        .lightbox-box button { background: var(--accent-color); color: #fff; border: none; padding: 12px 25px; border-radius: 5px; cursor: pointer; font-weight: bold; margin-top: 15px; width: 100%; }
    `;
    document.head.appendChild(style);
    
    handleTipoChange();
    switchSection('grafica');
    drawChart([]);
    if(exportExcelBtn) exportExcelBtn.disabled = true;

    loadFromSensorBtn?.addEventListener('click', () => {
        loadLatestSensorData(false);
    });
    
    exportExcelBtn?.addEventListener('click', exportToExcel);

    exportPdfBtn?.addEventListener('click', () => {
        if (currentData.length === 0) { showLightbox('Sin Datos', 'No hay datos para exportar.'); return; }
        if (currentPracticeInfo) {
            generatePdfWithInfo(currentPracticeInfo);
        } else { 
            modalAction = 'pdf'; 
            showSaveModal(); 
        }
    });
    saveRecordBtn?.addEventListener('click', () => {
        if (currentData.length === 0) { showLightbox('Sin Datos', 'No hay datos para guardar.'); return; }
        if (currentPracticeInfo) { showLightbox("Acción no permitida", "No puedes volver a guardar un registro del historial. Crea uno nuevo."); return; }
        modalAction = 'save';
        showSaveModal();
    });
    confirmSaveBtn?.addEventListener('click', () => {
        const practiceData = {
            practiceName: practiceNameInput?.value.trim(),
            practiceDescription: practiceDescriptionInput?.value.trim(),
            operators: Array.from(operatorsContainer.querySelectorAll('.operator-input')).map(i => i.value.trim()).filter(Boolean)
        };
        if (!practiceData.practiceName || practiceData.operators.length === 0) {
            showLightbox('Faltan Datos', 'El <b>nombre</b> y al menos un <b>operador</b> son requeridos.');
            return;
        }
        if (modalAction === 'save') {
            saveRecordToFirebase(practiceData);
        } else if (modalAction === 'pdf') {
            practiceData.testType = currentTestType;
            practiceData.probeta = { tipo: probetaTipoSelect.value, base: parseFloat(probetaBaseInput.value) || 0, altura: parseFloat(probetaAlturaInput.value) || 0, radio: parseFloat(probetaRadioInput.value) || 0, longitudInicial: probetaLM, area: probetaArea };
            generatePdfWithInfo(practiceData);
            hideSaveModal();
        }
    });

    clearGraphBtn?.addEventListener('click', () => {
        clearGraph();
    });
    subgraphButtons.forEach(button => button.addEventListener('click', () => displaySubgraph(button.dataset.zone)));
    viewFullGraphBtn?.addEventListener('click', () => drawChart(currentData, 'Curva Esfuerzo-Deformación Completa'));
    navButtons.forEach(button => button.addEventListener('click', () => switchSection(button.dataset.section)));
    closeModalBtn?.addEventListener('click', hideSaveModal);
    window.addEventListener('click', (event) => { if (event.target === saveModal) hideSaveModal(); });
    searchButton?.addEventListener('click', searchPractices);
    searchTermInput?.addEventListener('keyup', (e) => { if (e.key === 'Enter') searchPractices(); });
    practiceListUl?.addEventListener('click', (e) => { if (e.target.tagName === 'BUTTON' && e.target.dataset.key) loadSpecificPractice(e.target.dataset.key); });
    
    probetaTipoSelect?.addEventListener('change', handleTipoChange);
    [probetaBaseInput, probetaAlturaInput, probetaRadioInput, probetaLongitudInicialInput, probetaLongitudDespreciarInput].forEach(input => {
        input?.addEventListener('input', calculateProbetaProperties);
    });
    testTypeSelector?.addEventListener('change', (e) => {
        if (e.target.type === 'radio') {
            currentTestType = e.target.value;
        }
    });
    practiceDescriptionInput?.addEventListener('input', () => {
        const words = practiceDescriptionInput.value.trim().split(/\s+/).filter(Boolean).length;
        if (wordCountDiv) wordCountDiv.textContent = `${words} / 500 palabras`;
    });
});