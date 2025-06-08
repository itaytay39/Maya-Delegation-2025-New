// 🚀 Maya App connected to Google Sheets - Advanced Version
console.log("🚀 Initializing Maya App connected to Google Sheets...");

// System settings
const SHEET_CONFIG = {
    spreadsheetId: '1zunKbBVc74mtXfXkHjMDvQSpbu9n2PSasrxQ1CsRmvg',
    participantsUrl: 'https://docs.google.com/spreadsheets/d/1zunKbBVc74mtXfXkHjMDvQSpbu9n2PSasrxQ1CsRmvg/gviz/tq?tqx=out:csv',
    syncInterval: 30000, // Sync every 30 seconds
    appsScriptUrl: 'https://script.google.com/macros/s/AKfycbz1DrYpMY8F7awe-BuveOR_i8iwSiAHF7dRTgbh1j91beIyRy9GcIHcjhEeK3VIdlj31Q/exec' // The new URL you received
};

// Global variables
let participants = [];
let admin = false;
const adminPassword = "1234";
let editIdx = null;
let syncTimer = null;

// Advanced notification system
const ToastManager = {
    show: (message, type = 'success') => {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => {
                if (container.contains(toast)) {
                    container.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }
};

// Sync status system (updated to not fail if element is missing)
const SyncStatus = {
    element: null, // Initialized to null
    
    init() {
        // Try to get the element, but don't fail if it doesn't exist
        this.element = document.getElementById('sync-text');
    },
    
    update(message, isError = false) {
        if (this.element) { // Only update if the element actually exists
            this.element.textContent = message;
            const icon = document.querySelector('.sync-icon');
            if (icon) {
                icon.style.color = isError ? 'var(--md-error)' : 'var(--md-success)';
            }
        }
    }
};

// Google Sheets data loading system
const GoogleSheetsSync = {
    async loadParticipants() {
        try {
            console.log("📡 Loading data from Google Sheets...");
            // SyncStatus.update("Loading data..."); // Removed visual update here
            
            const response = await fetch(SHEET_CONFIG.participantsUrl);
            if (!response.ok) throw new Error('Network response was not ok');
            
            const csvText = await response.text();
            const rows = this.parseCSV(csvText);
            
            if (rows.length === 0) {
                throw new Error('No data in the sheet');
            }
            
            const headers = rows[0];
            participants = rows.slice(1)
                .filter(row => row[0] && row[0].trim()) // Filter empty rows
                .map(row => {
                    const obj = {};
                    headers.forEach((h, i) => {
                        obj[h.trim()] = row[i] ? row[i].trim().replace(/"/g, '') : '';
                    });
                    
                    return {
                        firstName: obj['שם פרטי'] || '',
                        lastName: obj['שם משפחה'] || '',
                        name: (obj['שם פרטי'] || '') + ' ' + (obj['שם משפחה'] || ''),
                        city: obj['עיר'] || '',
                        lat: parseFloat(obj['Lat']) || null,
                        lon: parseFloat(obj['Lon']) || null,
                        phone: this.formatPhone(obj['מספר טלפון'] || ''),
                        whatsapp: this.formatPhone(obj['מספר ווצאפ'] || obj['מספר WhatsApp'] || '')
                    };
                })
                .filter(p => p.lat && p.lon && !isNaN(p.lat) && !isNaN(p.lon)); // Filter invalid data
            
            console.log(`✅ Loaded ${participants.length} participants from the sheet`);
            // SyncStatus.update(`Loaded ${participants.length} participants`); // Removed visual update here
            ToastManager.show(`Loaded ${participants.length} participants from the sheet`);
            
            this.updateUI();
            
        } catch (error) {
            console.error("❌ Error loading data:", error);
            // SyncStatus.update("Error loading data", true); // Removed visual update here
            ToastManager.show('Error loading data from the sheet', 'error');
        }
    },
    
    parseCSV(csvText) {
        const lines = csvText.split('\n');
        return lines.map(line => {
            const result = [];
            let current = '';
            let inQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                const nextChar = line[i + 1];
                
                if (char === '"' && inQuotes && nextChar === '"') {
                    current += '"';
                    i++;
                } else if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    result.push(current);
                    current = '';
                } else {
                    current += char;
                }
            }
            result.push(current);
            return result;
        });
    },
    
    formatPhone(phone) {
        if (!phone) return '';
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length >= 9) {
            return '0' + cleaned.replace(/^0+/, '');
        }
        return phone;
    },
    
    updateUI() {
        if (typeof renderMarkers === 'function') renderMarkers();
        if (typeof updateParticipantCount === 'function') updateParticipantCount();
    },
    
    startAutoSync() {
        this.stopAutoSync();
        syncTimer = setInterval(() => {
            this.loadParticipants();
        }, SHEET_CONFIG.syncInterval);
        console.log("🔄 Auto sync activated");
    },
    
    stopAutoSync() {
        if (syncTimer) {
            clearInterval(syncTimer);
            syncTimer = null;
        }
    }
};

// Map variables declared globally, but initialized inside DOMContentLoaded
let map;
let markers;

// Custom marker icon
const createMarkerIcon = () => L.divIcon({
    className: 'modern-marker',
    html: `
        <div style="
            width: 36px;
            height: 36px;
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 3px solid white;
            box-shadow: 0 6px 16px rgba(99, 102, 241, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        ">
            <div style="
                width: 16px;
                height: 16px;
                background: white;
                border-radius: 50%;
                transform: rotate(45deg);
                box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
            "></div>
        </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36]
});

// Helper function to calculate distance
function distance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Update participant count
function updateParticipantCount() {
    const countElement = document.getElementById('participant-count');
    if (countElement) {
        countElement.textContent = `${participants.length} משתתפים`;
    }
}

// Display markers on the map
function renderMarkers(list = participants) {
    console.log("🗺️ Displaying markers on the map...");
    
    // Clear existing markers from the marker group
    markers.clearLayers();
    
    // Add new markers
    list.forEach((p, idx) => {
        if (!p.lat || !p.lon || isNaN(p.lat) || isNaN(p.lon)) return;
        
        const marker = L.marker([p.lat, p.lon], {icon: createMarkerIcon()});
        
        // Instead of binding a popup, bind a click event to open the custom bottom sheet
        marker.on('click', () => openParticipantBottomSheet(p, idx));
        
        markers.addLayer(marker); // Add the marker to the marker group
    });
    
    map.addLayer(markers); // Add the marker group to the map
    
    console.log(`✅ Displayed ${list.length} markers on the map`);
}

// --- Participant Details Bottom Sheet Logic ---
const participantBottomSheet = document.getElementById('participant-details-bottom-sheet');
const bottomSheetDetails = document.getElementById('bottom-sheet-details');
const bottomSheetCloseBtn = document.querySelector('.bottom-sheet-close-btn');

// Function to open the bottom sheet with participant data
function openParticipantBottomSheet(participant, idx) {
    bottomSheetDetails.innerHTML = ''; // Clear previous content

    const whatsappNum = (participant.whatsapp && participant.whatsapp.length > 0) ? participant.whatsapp : participant.phone;
    const hasWhatsapp = whatsappNum && whatsappNum.length >= 9;

    // Logic for nearby users
    let nearby = null;
    for (let j = 0; j < participants.length; j++) {
        const other = participants[j];
        if (other === participant || !other.lat || !other.lon) continue;
        if (distance(participant.lat, participant.lon, other.lat, other.lon) <= 10) {
            nearby = other;
            break;
        }
    }

    // Populate the bottom sheet with details
    bottomSheetDetails.innerHTML = `
        <div class="bottom-sheet-details-section">
            <span class="material-symbols-outlined">person</span>
            <h2>${participant.name}</h2>
        </div>
        <div class="bottom-sheet-details-section">
            <span class="material-symbols-outlined">location_on</span>
            <span>${participant.city}</span>
        </div>
        <div class="bottom-sheet-details-section">
            <span class="material-symbols-outlined">phone</span>
            <span>${participant.phone.replace(/^0(\d{2,3})(\d{7})$/, '0$1-$2')}</span>
        </div>

        <div class="bottom-sheet-details-buttons">
            <a href="tel:${participant.phone}" class="btn btn-primary">
                <span class="material-symbols-outlined">call</span>
                צור קשר
            </a>
            ${hasWhatsapp ? `
            <a href="https://wa.me/972${whatsappNum.replace(/^0/,'')}?text=${encodeURIComponent(`היי ${participant.firstName}, אשמח לתאם נסיעה משותפת למשלחת מאיה לאוגנדה! 🚗`)}" class="btn btn-primary" target="_blank">
                <span class="material-symbols-outlined">chat</span>
                וואטסאפ
            </a>
            ` : ''}
            ${admin ? `
            <button class="btn btn-secondary edit-btn" onclick="editUser(${idx}); closeParticipantBottomSheet();">
                <span class="material-symbols-outlined">edit</span>
                ערוך
            </button>
            <button class="btn btn-secondary delete-btn" onclick="deleteUser(${idx}); closeParticipantBottomSheet();">
                <span class="material-symbols-outlined">delete</span>
                מחק
            </button>
            ` : ''}
            ${nearby && hasWhatsapp ? `
            <button class="btn btn-secondary carpool-btn" onclick="suggestCarpool('${participant.name}', '${whatsappNum}'); closeParticipantBottomSheet();">
                <span class="material-symbols-outlined">directions_car</span>
                הצע נסיעה משותפת
            </button>
            ` : ''}
        </div>
    `;

    participantBottomSheet.hidden = false; // Show the bottom sheet
}

// Function to close the bottom sheet
function closeParticipantBottomSheet() {
    participantBottomSheet.hidden = true; // Hide the bottom sheet
}

// Event listener for bottom sheet close button
bottomSheetCloseBtn.addEventListener('click', closeParticipantBottomSheet);

// Close bottom sheet on outside click (overlay)
participantBottomSheet.addEventListener('click', (e) => {
    if (e.target === participantBottomSheet) { // Only close if clicking the background, not the content
        closeParticipantBottomSheet();
    }
});
// --- End Bottom Sheet Logic ---


// User management functions (updated to use bottom sheet where relevant)
window.editUser = function(idx) {
    if (!admin) {
        ToastManager.show('Admin permission required', 'error');
        return;
    }
    
    console.log(`✏️ Editing user: ${participants[idx].name}`);
    editIdx = idx;
    const p = participants[idx];
    
    document.getElementById('user-form-title').innerText = '✏️ עריכת משתתף';
    document.getElementById('user-first-name').value = p.firstName;
    document.getElementById('user-last-name').value = p.lastName;
    document.getElementById('user-city').value = p.city;
    document.getElementById('user-phone').value = p.phone;
    document.getElementById('user-whatsapp').value = p.whatsapp || '';
    
    document.getElementById('user-form-modal').hidden = false;
};

window.deleteUser = function(idx) {
    if (!admin) {
        ToastManager.show('Admin permission required', 'error');
        return;
    }
    
    const user = participants[idx];
    // In a live app, use a custom modal dialog for confirmation instead of alert/confirm.
    // For this example, only a console message will be printed.
    // If you'd like a custom confirmation modal implementation, please let me know.
    console.warn(`Delete request for ${user.name}. In a live app, a custom confirmation modal should be displayed here.`);
    
    // Proceed with the deletion logic
    console.log(`🗑️ Deleting user: ${user.name}`);

    const deletePayload = { id: user.name }; // Or another unique ID
    
    // Send delete request to Apps Script
    fetch(SHEET_CONFIG.appsScriptUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain;charset=utf-8' // Apps Script expects this format
        },
        body: JSON.stringify({ action: 'delete', payload: deletePayload })
    })
    .then(response => response.json())
    .then(result => {
        if (result.status === 'success') {
            ToastManager.show(`${user.name} deleted successfully`);
            GoogleSheetsSync.loadParticipants(); // Reload data so the map updates
        } else {
            ToastManager.show(`Error deleting: ${result.message}`, 'error');
        }
    })
    .catch(error => {
        console.error("❌ Error deleting user:", error);
        ToastManager.show('Error deleting data. Please try again.', 'error');
    });
};


window.suggestCarpool = function(name, phone) {
    console.log(`🚗 Suggesting carpool to: ${name}`);
    const message = encodeURIComponent(`היי ${name}, רוצה לתאם נסיעה משותפת למשלחת מאיה לאוגנדה! 🚗✈️🇺🇬`);
    window.open(`https://wa.me/972${phone.replace(/^0/,'')}?text=${message}`, '_blank');
};


// Admin system
function setAdminMode(isAdminMode) {
    admin = isAdminMode;
    const loginBtn = document.getElementById('admin-login-btn');
    const logoutBtn = document.getElementById('admin-logout-btn');
    const addBtn = document.getElementById('add-user-btn');
    const adminControls = document.getElementById('admin-controls');
    
    if (isAdminMode) {
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'flex';
        addBtn.style.display = 'block';
        adminControls.style.display = 'flex';
        ToastManager.show('Logged in as admin successfully! 🔐');
    } else {
        loginBtn.style.display = 'flex';
        logoutBtn.style.display = 'none';
        addBtn.style.display = 'none';
        adminControls.style.display = 'none';
        ToastManager.show('Logged out successfully! 👋');
    }
    
    renderMarkers();
}

// --- Import functionality ---
// Event listener for the import button to trigger the hidden file input
document.getElementById('import-btn').addEventListener('click', () => {
    if (!admin) {
        ToastManager.show('נדרשת הרשאת מנהל', 'error');
        return;
    }
    document.getElementById('file-input').click(); // Programmatically click the hidden file input
});

// Event listener for when a file is selected in the file input
document.getElementById('file-input').addEventListener('change', handleImport);

/**
 * Handles the import of an Excel file, parses it, and sends the data to Google Apps Script.
 * @param {Event} event The change event from the file input.
 */
async function handleImport(event) {
    if (!admin) {
        ToastManager.show('נדרשת הרשאת מנהל', 'error');
        return;
    }

    const file = event.target.files[0];
    if (!file) {
        return; // No file selected
    }

    // Show loading status
    // SyncStatus.update("טוען קובץ Excel...", false); // Removed visual update here
    ToastManager.show("טוען קובץ Excel...");

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });

            // Assuming the first sheet contains the participant data
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // Convert sheet to JSON array of objects.
            // This is typically the easiest format for Apps Script to consume.
            // Using skipHeader: false to include headers in the JSON array.
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }); // Read as array of arrays first

            if (jsonData.length === 0) {
                ToastManager.show('קובץ Excel ריק או בפורמט לא תקין.', 'error');
                // SyncStatus.update("שגיאה בייבוא קובץ", true); // Removed visual update here
                return;
            }

            // Extract headers (first row) and actual data rows
            const headers = jsonData[0];
            const rowsToImport = jsonData.slice(1);

            // Map rows to objects using headers as keys.
            // This ensures data matches Google Sheet columns expected by Apps Script.
            const participantsToImport = rowsToImport.map(row => {
                const obj = {};
                headers.forEach((header, index) => {
                    // Trim whitespace from header and value, handle empty cells
                    obj[header.trim()] = row[index] ? String(row[index]).trim() : '';
                });
                return obj;
            }).filter(obj => obj['שם פרטי'] && obj['שם משפחה']); // Filter out rows without basic info

            if (participantsToImport.length === 0) {
                ToastManager.show('לא נמצאו משתתפים חוקיים בקובץ Excel.', 'error');
                // SyncStatus.update("שגיאה בייבוא קובץ", true); // Removed visual update here
                return;
            }

            console.log("Parsed Excel data for import:", participantsToImport);
            // SyncStatus.update("שולח נתונים לשרת...", false); // Removed visual update here

            // Send the parsed data to Google Apps Script with an 'import' action
            const response = await fetch(SHEET_CONFIG.appsScriptUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8' // Apps Script expects this format
                },
                body: JSON.stringify({ action: 'import', payload: participantsToImport })
            });

            const result = await response.json();

            if (result.status === 'success') {
                ToastManager.show(`קובץ נתונים יובא בהצלחה! ${result.message || ''}`);
                await GoogleSheetsSync.loadParticipants(); // Reload map data after successful import
            } else {
                ToastManager.show(`שגיאה בייבוא קובץ: ${result.message || 'נסה שוב.'}`, 'error');
                // SyncStatus.update("שגיאה בייבוא קובץ", true); // Removed visual update here
            }

        } catch (error) {
            console.error("❌ Error processing Excel file:", error);
            ToastManager.show('שגיאה בעיבוד קובץ Excel. ודא שהפורמט נכון.', 'error');
            // SyncStatus.update("שגיאה בעיבוד קובץ", true); // Removed visual update here
        } finally {
            // Clear the file input so the same file can be selected again (important for 'change' event)
            event.target.value = ''; 
        }
    };
    reader.readAsArrayBuffer(file); // Read the file as an ArrayBuffer for XLSX.js
}
// --- End Import functionality ---


// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Initialize systems
    SyncStatus.init(); // SyncStatus will still be initialized, but will not update non-existent element

    // Map initialization (moved inside DOMContentLoaded)
    map = L.map('map').setView([31.5, 34.75], 8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    markers = L.markerClusterGroup(); // Initialize markers group here

    // Initial load
    GoogleSheetsSync.loadParticipants();
    GoogleSheetsSync.startAutoSync();
    
    // Admin login button
    document.getElementById('admin-login-btn').addEventListener('click', () => {
        document.getElementById('admin-login-modal').hidden = false;
        document.getElementById('admin-password').focus();
    });
    
    document.getElementById('admin-logout-btn').addEventListener('click', () => {
        setAdminMode(false);
    });
    
    // Admin login form
    document.getElementById('admin-login').addEventListener('click', () => {
        const password = document.getElementById('admin-password').value;
        
        if (password === adminPassword) {
            setAdminMode(true);
            document.getElementById('admin-login-modal').hidden = true;
            document.getElementById('admin-password').value = '';
        } else {
            ToastManager.show('Incorrect password!', 'error');
            document.getElementById('admin-password').value = '';
        }
    });
    
    document.getElementById('admin-cancel').addEventListener('click', () => {
        document.getElementById('admin-login-modal').hidden = true;
    });
    
    // Manual sync button
    document.getElementById('sync-btn').addEventListener('click', () => {
        if (!admin) return;
        GoogleSheetsSync.loadParticipants();
    });
    
    // Add user button
    document.getElementById('add-user-btn').addEventListener('click', () => {
        if (!admin) return;
        
        editIdx = null;
        document.getElementById('user-form-title').innerText = '➕ הוסף משתתף';
        document.getElementById('user-first-name').value = '';
        document.getElementById('user-last-name').value = '';
        document.getElementById('user-city').value = '';
        document.getElementById('user-phone').value = '';
        document.getElementById('user-whatsapp').value = '';
        document.getElementById('user-form-modal').hidden = false;
    });
    
    // Cancel user form
    document.getElementById('user-cancel').addEventListener('click', () => {
        document.getElementById('user-form-modal').hidden = true;
    });
    
    // Save user
    document.getElementById('user-save').addEventListener('click', async () => {
        if (!admin) return;
        
        const firstName = document.getElementById('user-first-name').value.trim();
        const lastName = document.getElementById('user-last-name').value.trim();
        const city = document.getElementById('user-city').value.trim();
        const phone = document.getElementById('user-phone').value.trim();
        const whatsapp = document.getElementById('user-whatsapp').value.trim();
        
        if (!firstName || !lastName || !city || !phone) {
            ToastManager.show('Please fill in all required fields', 'error');
            return;
        }
        
        const fullName = `${firstName} ${lastName}`;
        
        // User data to be sent to Apps Script, adapted to sheet headers
        const userData = {
            'שם פרטי': firstName,
            'שם משפחה': lastName,
            'עיר': city,
            'מספר טלפון': phone,
            'מספר ווצאפ': whatsapp,
            'Lat': (editIdx !== null) ? participants[editIdx].lat : null,
            'Lon': (editIdx !== null) ? participants[editIdx].lon : null,
        };

        let action = 'add';
        if (editIdx !== null) {
            action = 'update';
        }

        try {
            const saveBtn = document.getElementById('user-save');
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<span class="material-symbols-outlined">autorenew</span> Saving...';

            const response = await fetch(SHEET_CONFIG.appsScriptUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8'
                },
                body: JSON.stringify({ action, payload: userData })
            });

            const result = await response.json();

            if (result.status === 'success') {
                ToastManager.show(`${fullName} ${action === 'add' ? 'added' : 'updated'} successfully!`);
                await GoogleSheetsSync.loadParticipants();  
            } else {
                ToastManager.show(`Error saving: ${result.message}`, 'error');
            }
            
            document.getElementById('user-form-modal').hidden = true;
            editIdx = null; // Reset
        } catch (err) {
            console.error("❌ Error saving user:", err);
            ToastManager.show('Error saving data. Please try again.', 'error');
        } finally {
            const saveBtn = document.getElementById('user-save');
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<span class="material-symbols-outlined">save</span> Save';
        }
    });
    
    // Search
    document.getElementById('search-input').addEventListener('input', function() {
        const val = this.value.trim().toLowerCase();
        
        if (!val) {
            renderMarkers();
            return;
        }
        
        const filtered = participants.filter(p =>
            p.name.toLowerCase().includes(val) ||
            p.city.toLowerCase().includes(val) ||
            p.phone.includes(val)
        );
        
        renderMarkers(filtered);
    });
    
    // Close modals on outside click
    window.addEventListener('click', (e) => {
        // Close admin login modal if clicked outside its content
        if (e.target === document.getElementById('admin-login-modal')) { // Only close if clicking the modal background itself
            document.getElementById('admin-login-modal').hidden = true;
        }
        // Close user form modal if clicked outside its content
        if (e.target === document.getElementById('user-form-modal')) { // Only close if clicking the modal background itself
            document.getElementById('user-form-modal').hidden = true;
        }
    });
    
    // Adjust map to window size
    window.addEventListener('resize', () => {
        map.invalidateSize();
    });
    
    setTimeout(() => {
        map.invalidateSize();
    }, 500);

    // Logic for the "Reset map" button (its name was updated in HTML)
    document.getElementById('reset-map-btn').addEventListener('click', () => {
        map.setView([31.5, 34.75], 8); // Return to initial location and zoom (Israel, zoom 8)
        ToastManager.show('Map view reset to normal size! 🌍'); // Update message
    });
});

// Cleanup when the application closes
window.addEventListener('beforeunload', () => {
    GoogleSheetsSync.stopAutoSync();
});

console.log("✅ Maya App connected to Google Sheets ready for use!");
