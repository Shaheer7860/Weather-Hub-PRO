// ============================================
// PROFESSIONAL WEATHER HUB - JavaScript
// Advanced Features: 3D Globe, Charts, AQI, Alerts, Historical Data
// ============================================

// Register Chart.js plugins
if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
Chart.register(ChartDataLabels);
}

class WeatherApp {
    constructor() {
        this.apiKey = '99dd9e0dbf9344bebb2223518252110';
        this.baseURL = 'https://api.weatherapi.com/v1';
        this.forecastURL = `${this.baseURL}/forecast.json`;
        this.historyURL = `${this.baseURL}/history.json`;
        
        // Properties
        this.currentUnit = 'c';
        this.fullForecastData = null;
        this.chartInstances = {
            temperature: null,
            precipitation: null,
            wind: null
        };
        this.globeScene = null;
        this.globeCamera = null;
        this.globeRenderer = null;
        this.globeControls = null;
        this.currentLocation = null;
        
        // DOM Elements
        this.loadingEl = document.getElementById('loading');
        this.errorEl = document.getElementById('errorMessage');
        this.contentWrapperEl = document.getElementById('contentWrapper');
        
        // Initialize theme
        this.initTheme();
        
        this.initializeApp();
    }

    initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.body.className = savedTheme + '-mode';
        this.updateThemeIcon(savedTheme);
    }

    toggleTheme() {
        const currentTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.body.className = newTheme + '-mode';
        localStorage.setItem('theme', newTheme);
        this.updateThemeIcon(newTheme);
    }

    updateThemeIcon(theme) {
        const themeIcon = document.querySelector('#themeToggle i');
        if (themeIcon) {
            themeIcon.className = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
        }
    }

    initializeApp() {
        this.bindEvents();
        this.initGlobe();
        this.loadDefaultWeather();
    }

    bindEvents() {
        // Search
        const searchBtn = document.getElementById('searchBtn');
        const cityInput = document.getElementById('cityInput');
        const countryInput = document.getElementById('countryInput');

        searchBtn.addEventListener('click', () => this.searchWeather());
        cityInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchWeather();
        });
        countryInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchWeather();
        });

        // Unit toggle
        document.getElementById('toggleC').addEventListener('click', () => this.toggleUnits('c'));
        document.getElementById('toggleF').addEventListener('click', () => this.toggleUnits('f'));

        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());

        // Chart tabs
        document.querySelectorAll('.chart-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const chartType = e.currentTarget.dataset.chart;
                this.switchChart(chartType);
            });
        });

        // Alert close
        const alertClose = document.getElementById('alertClose');
        if (alertClose) {
            alertClose.addEventListener('click', () => {
                document.getElementById('alertBanner').style.display = 'none';
            });
        }

        // Historical data
        const loadHistorical = document.getElementById('loadHistorical');
        if (loadHistorical) {
            loadHistorical.addEventListener('click', () => this.loadHistoricalData());
        }

        // Set max date to today for historical input
        const historicalDate = document.getElementById('historicalDate');
        if (historicalDate) {
            const today = new Date();
            today.setDate(today.getDate() - 1); // Allow yesterday
            historicalDate.max = today.toISOString().split('T')[0];
        }
    }

    toggleUnits(unit) {
        if (this.currentUnit === unit) return;
        
        this.currentUnit = unit;
        document.getElementById('toggleC').classList.toggle('active', unit === 'c');
        document.getElementById('toggleF').classList.toggle('active', unit === 'f');

        if (this.fullForecastData) {
            this.updateUI();
        }
    }

    switchChart(chartType) {
        // Update tabs
        document.querySelectorAll('.chart-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.chart === chartType);
        });

        // Update chart wrappers
        document.querySelectorAll('.chart-wrapper').forEach(wrapper => {
            wrapper.classList.toggle('active', wrapper.id === chartType + 'Chart');
        });
    }

    async loadDefaultWeather() {
        this.showLoading();
        try {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        this.currentLocation = {
                            lat: position.coords.latitude,
                            lon: position.coords.longitude
                        };
                        this.fetchWeatherData(`${position.coords.latitude},${position.coords.longitude}`);
                    },
                    () => this.fetchWeatherData('London')
                );
            } else {
                this.fetchWeatherData('London');
            }
        } catch (error) {
            this.showError('Error loading default weather.');
        }
    }

    async searchWeather() {
        const city = document.getElementById('cityInput').value.trim();
        const country = document.getElementById('countryInput').value.trim();
        
        if (!city) {
            this.showError('Please enter a city name');
            return;
        }

        let location = country ? `${city}, ${country}` : city;
        this.showLoading();
        await this.fetchWeatherData(location);
    }

    async fetchWeatherData(locationQuery) {
        try {
            const response = await fetch(
                `${this.forecastURL}?key=${this.apiKey}&q=${locationQuery}&days=5&aqi=yes&alerts=yes`
            );
            
            if (!response.ok) {
                throw new Error('City not found');
            }

            this.fullForecastData = await response.json();
            this.currentLocation = {
                lat: this.fullForecastData.location.lat,
                lon: this.fullForecastData.location.lon
            };
            
            this.updateUI();
            this.updateGlobe();
            this.hideError();
            this.contentWrapperEl.style.display = 'block';
        } catch (error) {
            console.error('Error fetching weather:', error);
            this.showError('Signal Lost. Location not found.');
            this.contentWrapperEl.style.display = 'none';
        } finally {
            this.hideLoading();
        }
    }

    updateUI() {
        if (!this.fullForecastData) return;
        
        this.displayCurrentWeather(this.fullForecastData);
        this.displayAirQuality(this.fullForecastData);
        this.displayDailyForecast(this.fullForecastData);
        this.displayHourlyForecast(this.fullForecastData);
        this.displayCharts(this.fullForecastData);
        this.checkAlerts(this.fullForecastData);
    }

    displayCurrentWeather(data) {
        const unit = this.currentUnit;
        const tempKey = `temp_${unit}`;
        const highKey = `maxtemp_${unit}`;
        const lowKey = `mintemp_${unit}`;
        const feelsLikeKey = `feelslike_${unit}`;
        const windKey = unit === 'c' ? 'wind_kph' : 'wind_mph';
        const visKey = unit === 'c' ? 'vis_km' : 'vis_miles';

        const current = data.current;
        const todayForecast = data.forecast.forecastday[0].day;

        // Location and time
        document.getElementById('currentLocation').textContent = 
            `${data.location.name}, ${data.location.region || data.location.country}`;
        
        const localTime = new Date(data.location.localtime).toLocaleTimeString('en-US', {
            hour: 'numeric', minute: '2-digit', hour12: true
        });
        document.getElementById('currentTime').textContent = localTime;
        document.getElementById('currentUpdated').textContent = `Live Data Feed as of ${localTime}`;

        // Main temperature
        document.getElementById('currentTemp').textContent = Math.round(current[tempKey]);
        document.getElementById('currentCondition').textContent = current.condition.text;
        
        const highTemp = Math.round(todayForecast[highKey]);
        const lowTemp = Math.round(todayForecast[lowKey]);
        document.getElementById('currentHL').textContent = `H: ${highTemp}° L: ${lowTemp}°`;
        
        document.getElementById('currentIcon').className = this.getWeatherIcon(current.condition.text, current.is_day);

        // Additional details
        document.getElementById('humidity').textContent = `${current.humidity}%`;
        document.getElementById('windSpeed').textContent = `${Math.round(current[windKey])} ${unit === 'c' ? 'km/h' : 'mph'}`;
        document.getElementById('visibility').textContent = `${Math.round(current[visKey])} ${unit === 'c' ? 'km' : 'mi'}`;
        document.getElementById('feelsLike').textContent = `${Math.round(current[feelsLikeKey])}°`;
        document.getElementById('pressure').textContent = `${current.pressure_mb} mb`;
        document.getElementById('uvIndex').textContent = current.uv;
    }

    displayAirQuality(data) {
        if (!data.current.air_quality) {
            document.getElementById('aqiValue').textContent = 'N/A';
            document.getElementById('aqiStatus').textContent = 'Data unavailable';
            return;
        }

        const aqi = data.current.air_quality['us-epa-index'];
        const aqiValue = aqi || 0;
        
        document.getElementById('aqiValue').textContent = aqiValue;
        
        // Update AQI bar
        const aqiBar = document.getElementById('aqiBar');
        const percentage = Math.min((aqiValue / 6) * 100, 100);
        aqiBar.style.width = `${percentage}%`;
        
        // AQI status
        let status = '';
        let color = '';
        if (aqiValue <= 1) {
            status = 'Good';
            color = '#00ff88';
        } else if (aqiValue <= 2) {
            status = 'Moderate';
            color = '#ffaa00';
        } else if (aqiValue <= 3) {
            status = 'Unhealthy for Sensitive Groups';
            color = '#ff8800';
        } else if (aqiValue <= 4) {
            status = 'Unhealthy';
            color = '#ff4444';
        } else if (aqiValue <= 5) {
            status = 'Very Unhealthy';
            color = '#cc0000';
        } else {
            status = 'Hazardous';
            color = '#990000';
        }
        
        document.getElementById('aqiStatus').textContent = status;
        aqiBar.style.background = `linear-gradient(90deg, ${color} 0%, ${color} 100%)`;
        
        // Health metrics
        const aq = data.current.air_quality;
        document.getElementById('pm25').textContent = aq.pm2_5 ? aq.pm2_5.toFixed(1) : 'N/A';
        document.getElementById('pm10').textContent = aq.pm10 ? aq.pm10.toFixed(1) : 'N/A';
        document.getElementById('o3').textContent = aq.o3 ? aq.o3.toFixed(1) : 'N/A';
        document.getElementById('no2').textContent = aq.no2 ? aq.no2.toFixed(1) : 'N/A';
    }

    displayDailyForecast(data) {
        const container = document.getElementById('dailyForecastContainer');
        container.innerHTML = '';
        
        const unit = this.currentUnit;
        const highKey = `maxtemp_${unit}`;
        const lowKey = `mintemp_${unit}`;

        data.forecast.forecastday.forEach((day, index) => {
            const item = document.createElement('div');
            item.className = 'daily-item';
            
            let dayName = new Date(day.date).toLocaleDateString('en-US', { weekday: 'long' });
            
            if (index === 0) {
                item.classList.add('today');
                dayName = 'Today';
            } else if (index === 1) {
                dayName = 'Tomorrow';
            }

            const icon = this.getWeatherIcon(day.day.condition.text, 1);
            const high = Math.round(day.day[highKey]);
            const low = Math.round(day.day[lowKey]);
            const precip = day.day.daily_chance_of_rain;

            item.innerHTML = `
                <div class="daily-item-left">
                <div class="daily-day">${dayName}</div>
                <i class="daily-icon ${icon}"></i>
                    <div class="daily-condition">${day.day.condition.text}</div>
                </div>
                <div class="daily-item-right">
                    <div class="daily-precip">${precip > 0 ? `💧 ${precip}%` : ''}</div>
                    <div class="daily-temps">
                <div class="daily-temp-high">${high}°</div>
                <div class="daily-temp-low">${low}°</div>
                    </div>
                </div>
            `;
            container.appendChild(item);
        });
    }

    displayHourlyForecast(data) {
        const container = document.getElementById('hourlyForecastContainer');
        container.innerHTML = '';
        
        const unit = this.currentUnit;
        const tempKey = `temp_${unit}`;
        const windKey = unit === 'c' ? 'wind_kph' : 'wind_mph';
        
        // Get next 24 hours
        const hours = [];
        const today = data.forecast.forecastday[0].hour;
        const tomorrow = data.forecast.forecastday[1] ? data.forecast.forecastday[1].hour : [];
        
        const currentHour = new Date(data.location.localtime).getHours();
        const upcomingToday = today.filter(h => new Date(h.time).getHours() >= currentHour);
        const upcomingTomorrow = tomorrow.slice(0, 24 - upcomingToday.length);
        
        hours.push(...upcomingToday, ...upcomingTomorrow);
        
        hours.slice(0, 24).forEach(hour => {
            const item = document.createElement('div');
            item.className = 'hourly-item';
            
            const time = new Date(hour.time);
            const timeStr = time.toLocaleTimeString('en-US', {
                hour: 'numeric',
                hour12: true
            }).replace(' ', '');
            
            const icon = this.getWeatherIcon(hour.condition.text, hour.is_day);
            const temp = Math.round(hour[tempKey]);
            const precip = hour.chance_of_rain;
            const wind = Math.round(hour[windKey]);
            
            item.innerHTML = `
                <div class="hourly-time">${timeStr}</div>
                <i class="hourly-icon ${icon}"></i>
                <div class="hourly-temp">${temp}°</div>
                ${precip > 0 ? `<div class="hourly-precip">💧 ${precip}%</div>` : ''}
                <div class="hourly-wind">💨 ${wind} ${unit === 'c' ? 'km/h' : 'mph'}</div>
            `;
            container.appendChild(item);
        });
    }

    displayCharts(data) {
        const unit = this.currentUnit;
        const tempKey = `temp_${unit}`;
        const windKey = unit === 'c' ? 'wind_kph' : 'wind_mph';
        
        // Get 24 hours of data
        const hours = [];
        const today = data.forecast.forecastday[0].hour;
        const tomorrow = data.forecast.forecastday[1] ? data.forecast.forecastday[1].hour : [];
        
        const currentHour = new Date(data.location.localtime).getHours();
        const upcomingToday = today.filter(h => new Date(h.time).getHours() >= currentHour);
        const upcomingTomorrow = tomorrow.slice(0, 24 - upcomingToday.length);
        hours.push(...upcomingToday, ...upcomingTomorrow);
        
        const labels = hours.slice(0, 24).map(h => {
            const time = new Date(h.time);
            return time.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
        });
        
        // Temperature Chart
        this.createTemperatureChart(labels, hours.slice(0, 24), tempKey, unit);
        
        // Precipitation Chart
        this.createPrecipitationChart(labels, hours.slice(0, 24));
        
        // Wind Chart
        this.createWindChart(labels, hours.slice(0, 24), windKey, unit);
    }

    createTemperatureChart(labels, hours, tempKey, unit) {
        const ctx = document.getElementById('tempChart');
        if (!ctx) return;
        
        const temps = hours.map(h => Math.round(h[tempKey]));
        const feelsLike = hours.map(h => Math.round(h[`feelslike_${unit}`]));
        
        if (this.chartInstances.temperature) {
            this.chartInstances.temperature.destroy();
        }
        
        const isDark = document.body.classList.contains('dark-mode');
        const textColor = isDark ? '#e0f4ff' : '#1a1a2e';
        const gridColor = isDark ? 'rgba(0, 240, 255, 0.1)' : 'rgba(0, 102, 204, 0.1)';
        
        this.chartInstances.temperature = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Temperature',
                        data: temps,
                        borderColor: '#00f0ff',
                        backgroundColor: 'rgba(0, 240, 255, 0.1)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 3,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                    },
                    {
                        label: 'Feels Like',
                        data: feelsLike,
                        borderColor: '#ffaa00',
                        backgroundColor: 'rgba(255, 170, 0, 0.1)',
                    fill: true,
                        tension: 0.4,
                    borderWidth: 2,
                        borderDash: [5, 5],
                        pointRadius: 3,
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            color: textColor,
                            font: { family: 'Rajdhani', size: 14, weight: '600' }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: textColor,
                        bodyColor: textColor,
                        borderColor: '#00f0ff',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        ticks: { color: textColor },
                        grid: { color: gridColor }
                    },
                    y: {
                        ticks: { color: textColor },
                        grid: { color: gridColor }
                    }
                }
            }
        });
    }

    createPrecipitationChart(labels, hours) {
        const ctx = document.getElementById('precipChart');
        if (!ctx) return;
        
        const precip = hours.map(h => h.precip_mm || 0);
        const chance = hours.map(h => h.chance_of_rain || 0);
        
        if (this.chartInstances.precipitation) {
            this.chartInstances.precipitation.destroy();
        }
        
        const isDark = document.body.classList.contains('dark-mode');
        const textColor = isDark ? '#e0f4ff' : '#1a1a2e';
        const gridColor = isDark ? 'rgba(0, 240, 255, 0.1)' : 'rgba(0, 102, 204, 0.1)';
        
        this.chartInstances.precipitation = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Precipitation (mm)',
                        data: precip,
                        backgroundColor: 'rgba(52, 152, 219, 0.6)',
                        borderColor: '#3498db',
                        borderWidth: 2,
                    },
                    {
                        label: 'Chance of Rain (%)',
                        data: chance,
                        type: 'line',
                        borderColor: '#00f0ff',
                        backgroundColor: 'rgba(0, 240, 255, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        yAxisID: 'y1',
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            color: textColor,
                            font: { family: 'Rajdhani', size: 14, weight: '600' }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: textColor,
                        bodyColor: textColor,
                        borderColor: '#3498db',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        ticks: { color: textColor },
                        grid: { color: gridColor }
                    },
                    y: {
                        type: 'linear',
                        position: 'left',
                        ticks: { color: textColor },
                        grid: { color: gridColor }
                    },
                    y1: {
                        type: 'linear',
                        position: 'right',
                        ticks: { color: textColor },
                        grid: { display: false }
                    }
                }
            }
        });
    }

    createWindChart(labels, hours, windKey, unit) {
        const ctx = document.getElementById('windChartCanvas');
        if (!ctx) return;
        
        const windSpeed = hours.map(h => Math.round(h[windKey]));
        const windGust = hours.map(h => {
            const gustKey = unit === 'c' ? 'gust_kph' : 'gust_mph';
            return Math.round(h[gustKey] || h[windKey] * 1.2); // Fallback to 20% higher if no gust data
        });
        
        if (this.chartInstances.wind) {
            this.chartInstances.wind.destroy();
        }
        
        const isDark = document.body.classList.contains('dark-mode');
        const textColor = isDark ? '#e0f4ff' : '#1a1a2e';
        const gridColor = isDark ? 'rgba(0, 240, 255, 0.1)' : 'rgba(0, 102, 204, 0.1)';
        
        this.chartInstances.wind = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Wind Speed',
                        data: windSpeed,
                        borderColor: '#00f0ff',
                        backgroundColor: 'rgba(0, 240, 255, 0.1)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 3,
                        pointRadius: 4,
                    },
                    {
                        label: 'Wind Gusts',
                        data: windGust,
                        borderColor: '#ff4444',
                        backgroundColor: 'rgba(255, 68, 68, 0.1)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 2,
                        borderDash: [5, 5],
                        pointRadius: 3,
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            color: textColor,
                            font: { family: 'Rajdhani', size: 14, weight: '600' }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: textColor,
                        bodyColor: textColor,
                        borderColor: '#00f0ff',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        ticks: { color: textColor },
                        grid: { color: gridColor }
                    },
                    y: {
                        ticks: { 
                            color: textColor,
                            callback: function(value) {
                                return value + (unit === 'c' ? ' km/h' : ' mph');
                            }
                        },
                        grid: { color: gridColor }
                    }
                }
            }
        });
    }

    checkAlerts(data) {
        const alertBanner = document.getElementById('alertBanner');
        const alertTitle = document.getElementById('alertTitle');
        const alertMessage = document.getElementById('alertMessage');
        
        if (data.alerts && data.alerts.alert && data.alerts.alert.length > 0) {
            const alert = data.alerts.alert[0];
            alertTitle.textContent = alert.headline || 'Severe Weather Alert';
            alertMessage.textContent = alert.desc || alert.msgtype || 'Active weather alert';
            alertBanner.style.display = 'block';
        } else {
            alertBanner.style.display = 'none';
        }
    }

    initGlobe() {
        // Wait for Three.js to load and DOM to be ready
        const initGlobeWhenReady = () => {
            const canvas = document.getElementById('globeCanvas');
            if (!canvas) {
                console.warn('Globe canvas not found, retrying...');
                setTimeout(initGlobeWhenReady, 200);
                return;
            }
            
            if (typeof THREE === 'undefined') {
                console.warn('Three.js not loaded, retrying...');
                setTimeout(initGlobeWhenReady, 200);
                return;
            }
            
            try {
                // Ensure canvas has dimensions
                const container = canvas.parentElement;
                if (!container) {
                    console.warn('Globe container not found');
                    return;
                }
                
                // Wait a bit for container to have dimensions
                const width = container.clientWidth || 800;
                const height = container.clientHeight || 500;
                
                if (width === 0 || height === 0) {
                    setTimeout(initGlobeWhenReady, 200);
                    return;
                }
                
                // Set canvas dimensions explicitly
                canvas.setAttribute('width', width);
                canvas.setAttribute('height', height);
                canvas.style.width = width + 'px';
                canvas.style.height = height + 'px';
                canvas.style.display = 'block';
                canvas.style.visibility = 'visible';
                
                // Scene setup
                this.globeScene = new THREE.Scene();
                const aspect = width / height;
                this.globeCamera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
                this.globeRenderer = new THREE.WebGLRenderer({ 
                    canvas: canvas, 
                    antialias: true, 
                    alpha: true,
                    powerPreference: "high-performance"
                });
                this.globeRenderer.setSize(width, height);
                this.globeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
                this.globeRenderer.setClearColor(0x000000, 0);
                
                // Mouse controls and click detection
                let isDragging = false;
                let previousMousePosition = { x: 0, y: 0 };
                let clickStartTime = 0;
                let clickStartPosition = { x: 0, y: 0 };
                let autoRotate = true;
                
                // Raycaster for click detection
                const raycaster = new THREE.Raycaster();
                const mouse = new THREE.Vector2();
                
                canvas.addEventListener('mousedown', (e) => {
                    isDragging = true;
                    autoRotate = false; // Stop auto-rotation while dragging
                    clickStartTime = Date.now();
                    clickStartPosition = { x: e.clientX, y: e.clientY };
                    previousMousePosition = { x: e.clientX, y: e.clientY };
                    canvas.style.cursor = 'grabbing';
                });
                
                canvas.addEventListener('mousemove', (e) => {
                    if (isDragging) {
                        const deltaX = e.clientX - previousMousePosition.x;
                        const deltaY = e.clientY - previousMousePosition.y;
                        const earth = this.globeScene.children.find(child => child.userData.isEarth);
                        if (earth) {
                            earth.rotation.y += deltaX * 0.01;
                            earth.rotation.x += deltaY * 0.01;
                        }
                        previousMousePosition = { x: e.clientX, y: e.clientY };
                    }
                });
                
                canvas.addEventListener('mouseup', (e) => {
                    const clickDuration = Date.now() - clickStartTime;
                    const clickDistance = Math.sqrt(
                        Math.pow(e.clientX - clickStartPosition.x, 2) + 
                        Math.pow(e.clientY - clickStartPosition.y, 2)
                    );
                    
                    // If it was a quick click with minimal movement, treat as location selection
                    if (clickDuration < 200 && clickDistance < 5) {
                        this.handleGlobeClick(e, canvas, raycaster, mouse);
                    }
                    
                    isDragging = false;
                    autoRotate = true; // Resume auto-rotation
                    canvas.style.cursor = 'grab';
                });
                
                canvas.addEventListener('mouseleave', () => {
                    isDragging = false;
                    canvas.style.cursor = 'grab';
                });
                
                canvas.style.cursor = 'grab';
                
                // Try to use OrbitControls if available
                if (typeof THREE.OrbitControls !== 'undefined') {
                    this.globeControls = new THREE.OrbitControls(this.globeCamera, canvas);
                    this.globeControls.enableDamping = true;
                    this.globeControls.dampingFactor = 0.05;
                } else if (typeof OrbitControls !== 'undefined') {
                    this.globeControls = new OrbitControls(this.globeCamera, canvas);
                    this.globeControls.enableDamping = true;
                    this.globeControls.dampingFactor = 0.05;
                }
                
                // Create sphere (Earth) with world map texture
                const geometry = new THREE.SphereGeometry(2, 64, 64);
                
                // Load Earth texture - try multiple sources
                const textureLoader = new THREE.TextureLoader();
                const earthTextureUrls = [
                    'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg',
                    'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg',
                    'https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/textures/planets/earth_atmos_2048.jpg'
                ];
                
                let textureLoaded = false;
                const earth = new THREE.Mesh();
                earth.userData.isEarth = true;
                
                // Try to load texture
                const tryLoadTexture = (urlIndex = 0) => {
                    if (urlIndex >= earthTextureUrls.length) {
                        // All URLs failed, use fallback
                        console.warn('All Earth texture URLs failed, using fallback');
                        earth.material = new THREE.MeshPhongMaterial({
                            color: 0x2233ff,
                            emissive: 0x001122,
                            shininess: 100
                        });
                        earth.geometry = geometry;
                        this.globeScene.add(earth);
                        this.globeEarth = earth;
                        return;
                    }
                    
                    textureLoader.load(
                        earthTextureUrls[urlIndex],
                        (texture) => {
                            console.log('Earth texture loaded from:', earthTextureUrls[urlIndex]);
                            textureLoaded = true;
                            earth.material = new THREE.MeshPhongMaterial({
                                map: texture,
                                emissive: 0x001122,
                                emissiveIntensity: 0.1,
                                shininess: 100
                            });
                            earth.geometry = geometry;
                            this.globeScene.add(earth);
                            this.globeEarth = earth;
                        },
                        undefined,
                        (error) => {
                            console.warn('Failed to load texture from:', earthTextureUrls[urlIndex]);
                            tryLoadTexture(urlIndex + 1);
                        }
                    );
                };
                
                tryLoadTexture();
                
                // Add lights
                const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
                this.globeScene.add(ambientLight);
                
                const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
                directionalLight.position.set(5, 5, 5);
                this.globeScene.add(directionalLight);
                
                // Camera position
                this.globeCamera.position.z = 5;
                
                // Animation loop
                const animate = () => {
                    requestAnimationFrame(animate);
                    if (this.globeControls) {
                        this.globeControls.update();
                    }
                    const earthMesh = this.globeScene.children.find(child => child.userData.isEarth);
                    if (earthMesh && autoRotate && !isDragging) {
                        earthMesh.rotation.y += 0.002;
                    }
                    this.globeRenderer.render(this.globeScene, this.globeCamera);
                };
                animate();
                
                // Handle resize
                const handleResize = () => {
                    if (canvas && this.globeCamera && this.globeRenderer) {
                        const container = canvas.parentElement;
                        if (container) {
                            const width = container.clientWidth || 800;
                            const height = container.clientHeight || 500;
                            
                            canvas.width = width;
                            canvas.height = height;
                            
                            this.globeCamera.aspect = width / height;
                            this.globeCamera.updateProjectionMatrix();
                            this.globeRenderer.setSize(width, height);
                        }
                    }
                };
                window.addEventListener('resize', handleResize);
                
                // Hide loading indicator
                const loadingEl = document.getElementById('globeLoading');
                if (loadingEl) {
                    loadingEl.classList.add('hidden');
                }
                
                console.log('3D Globe initialized successfully');
            } catch (error) {
                console.error('Error initializing globe:', error);
                const loadingEl = document.getElementById('globeLoading');
                if (loadingEl) {
                    loadingEl.innerHTML = '<p>Unable to load 3D Globe. Please refresh the page.</p>';
                }
            }
        };
        
        // Try to initialize immediately, or wait a bit for Three.js
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(initGlobeWhenReady, 300);
            });
        } else {
            // Give a small delay to ensure Three.js is loaded and container has dimensions
            setTimeout(initGlobeWhenReady, 300);
        }
    }

    handleGlobeClick(event, canvas, raycaster, mouse) {
        if (!this.globeEarth || !this.globeCamera) return;
        
        // Calculate mouse position in normalized device coordinates
        const rect = canvas.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Update raycaster
        raycaster.setFromCamera(mouse, this.globeCamera);
        
        // Check for intersection with Earth
        const intersects = raycaster.intersectObject(this.globeEarth);
        
        if (intersects.length > 0) {
            const intersection = intersects[0];
            const point = intersection.point;
            
            // Convert 3D point to lat/lon
            // The point is in local space, so we need to account for Earth's rotation
            const radius = 2; // Earth radius in the scene
            
            // Normalize the point
            const length = Math.sqrt(point.x * point.x + point.y * point.y + point.z * point.z);
            const normalizedPoint = new THREE.Vector3(
                point.x / length,
                point.y / length,
                point.z / length
            );
            
            // Calculate latitude (from -90 to 90)
            const lat = Math.asin(normalizedPoint.y) * (180 / Math.PI);
            
            // Calculate longitude (from -180 to 180)
            // Account for Earth's rotation
            let lon = Math.atan2(normalizedPoint.z, normalizedPoint.x) * (180 / Math.PI);
            
            // Adjust for Earth's current rotation
            const earthRotationY = this.globeEarth.rotation.y * (180 / Math.PI);
            lon = lon - earthRotationY;
            
            // Normalize longitude to -180 to 180
            while (lon > 180) lon -= 360;
            while (lon < -180) lon += 360;
            
            // Update location and fetch weather
            this.currentLocation = { lat, lon };
            
            // Update info display immediately
            const coordsEl = document.getElementById('globeCoords');
            if (coordsEl) {
                coordsEl.textContent = `Lat: ${lat.toFixed(2)}, Lon: ${lon.toFixed(2)}`;
            }
            const locationEl = document.getElementById('globeLocation');
            if (locationEl) {
                locationEl.textContent = 'Loading weather...';
            }
            
            this.showLoading();
            this.fetchWeatherData(`${lat},${lon}`);
            
            // Visual feedback
            this.showClickMarker(point);
        }
    }

    showClickMarker(point) {
        if (!this.globeScene) return;
        
        // Remove old click markers
        const oldMarkers = this.globeScene.children.filter(child => child.userData.isClickMarker);
        oldMarkers.forEach(m => this.globeScene.remove(m));
        
        // Create click marker (ring effect)
        const markerGeometry = new THREE.RingGeometry(0.1, 0.15, 16);
        const markerMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x00ff00,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8
        });
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        
        // Position marker on sphere surface
        const radius = 2.05;
        const length = Math.sqrt(point.x * point.x + point.y * point.y + point.z * point.z);
        marker.position.set(
            (point.x / length) * radius,
            (point.y / length) * radius,
            (point.z / length) * radius
        );
        
        // Orient marker to face camera
        marker.lookAt(this.globeCamera.position);
        
        marker.userData.isClickMarker = true;
        this.globeScene.add(marker);
        
        // Animate marker
        let scale = 1;
        const animate = () => {
            scale += 0.02;
            if (scale > 1.5) scale = 1;
            marker.scale.set(scale, scale, 1);
            if (marker.parent) {
                requestAnimationFrame(animate);
            }
        };
        animate();
        
        // Remove after 2 seconds
        setTimeout(() => {
            if (marker.parent) {
                this.globeScene.remove(marker);
            }
        }, 2000);
    }

    updateGlobe() {
        if (!this.currentLocation || !this.globeScene || typeof THREE === 'undefined') return;
        
        try {
            // Remove old location markers (but keep click markers)
            const oldMarkers = this.globeScene.children.filter(child => 
                child.userData.isMarker && !child.userData.isClickMarker
            );
            oldMarkers.forEach(m => this.globeScene.remove(m));
            
            // Add marker for current location
            const markerGeometry = new THREE.SphereGeometry(0.08, 16, 16);
            const markerMaterial = new THREE.MeshBasicMaterial({ 
                color: 0xff0000,
                emissive: 0xff0000,
                emissiveIntensity: 0.5
            });
            const marker = new THREE.Mesh(markerGeometry, markerMaterial);
            
            // Convert lat/lon to 3D position (spherical coordinates)
            const phi = (90 - this.currentLocation.lat) * (Math.PI / 180);
            const theta = (this.currentLocation.lon + 180) * (Math.PI / 180);
            const radius = 2.08;
            
            marker.position.x = -radius * Math.sin(phi) * Math.cos(theta);
            marker.position.y = radius * Math.cos(phi);
            marker.position.z = radius * Math.sin(phi) * Math.sin(theta);
            
            marker.userData.isMarker = true;
            this.globeScene.add(marker);
            
            // Add pulsing effect
            let pulseScale = 1;
            const pulse = () => {
                if (marker.material && marker.parent) {
                    pulseScale = 1 + Math.sin(Date.now() * 0.005) * 0.3;
                    marker.scale.set(pulseScale, pulseScale, pulseScale);
                    requestAnimationFrame(pulse);
                }
            };
            pulse();
            
            // Update info
            if (this.fullForecastData) {
                const locationEl = document.getElementById('globeLocation');
                const coordsEl = document.getElementById('globeCoords');
                if (locationEl) {
                    locationEl.textContent = 
                        `${this.fullForecastData.location.name}, ${this.fullForecastData.location.country}`;
                }
                if (coordsEl) {
                    coordsEl.textContent = 
                        `Lat: ${this.currentLocation.lat.toFixed(2)}, Lon: ${this.currentLocation.lon.toFixed(2)}`;
                }
            }
        } catch (error) {
            console.error('Error updating globe:', error);
        }
    }

    async loadHistoricalData() {
        const dateInput = document.getElementById('historicalDate');
        const selectedDate = dateInput.value;
        
        if (!selectedDate) {
            this.showError('Please select a date');
            return;
        }
        
        if (!this.currentLocation) {
            this.showError('Please search for a location first');
            return;
        }
        
        this.showLoading();
        
        try {
            const location = `${this.currentLocation.lat},${this.currentLocation.lon}`;
            const response = await fetch(
                `${this.historyURL}?key=${this.apiKey}&q=${location}&dt=${selectedDate}`
            );
            
            if (!response.ok) {
                throw new Error('Historical data not available');
            }
            
            const data = await response.json();
            this.displayHistoricalData(data);
        } catch (error) {
            console.error('Error fetching historical data:', error);
            this.showError('Unable to load historical data for this date');
        } finally {
            this.hideLoading();
        }
    }

    displayHistoricalData(data) {
        const resultsContainer = document.getElementById('historicalResults');
        if (!resultsContainer || !data.forecast || !data.forecast.forecastday || data.forecast.forecastday.length === 0) {
            resultsContainer.innerHTML = '<p class="historical-placeholder">No historical data available for this date.</p>';
            return;
        }
        
        const unit = this.currentUnit;
        const highKey = `maxtemp_${unit}`;
        const lowKey = `mintemp_${unit}`;
        const avgKey = unit === 'c' ? 'avgtemp_c' : 'avgtemp_f';
        
        const day = data.forecast.forecastday[0].day;
        const astro = data.forecast.forecastday[0].astro;
        
        resultsContainer.innerHTML = `
            <div class="historical-data-grid">
                <div class="historical-data-item">
                    <strong>Date</strong>
                    ${new Date(data.forecast.forecastday[0].date).toLocaleDateString('en-US', { 
                        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
                    })}
                </div>
                <div class="historical-data-item">
                    <strong>Max Temperature</strong>
                    ${Math.round(day[highKey] || day.maxtemp_c || day.maxtemp_f || 0)}°
                </div>
                <div class="historical-data-item">
                    <strong>Min Temperature</strong>
                    ${Math.round(day[lowKey] || day.mintemp_c || day.mintemp_f || 0)}°
                </div>
                <div class="historical-data-item">
                    <strong>Average Temperature</strong>
                    ${Math.round(day[avgKey] || day.avgtemp_c || day.avgtemp_f || 0)}°
                </div>
                <div class="historical-data-item">
                    <strong>Condition</strong>
                    ${day.condition ? day.condition.text : 'N/A'}
                </div>
                <div class="historical-data-item">
                    <strong>Precipitation</strong>
                    ${(day.totalprecip_mm || 0).toFixed(1)} mm
                </div>
                <div class="historical-data-item">
                    <strong>Max Wind Speed</strong>
                    ${day.maxwind_kph || day.maxwind_mph || 0} ${day.maxwind_kph ? 'km/h' : 'mph'}
                </div>
                <div class="historical-data-item">
                    <strong>Average Humidity</strong>
                    ${day.avghumidity || 0}%
                </div>
                <div class="historical-data-item">
                    <strong>Sunrise</strong>
                    ${astro ? astro.sunrise : 'N/A'}
                </div>
                <div class="historical-data-item">
                    <strong>Sunset</strong>
                    ${astro ? astro.sunset : 'N/A'}
                </div>
            </div>
        `;
    }

    getWeatherIcon(conditionText, isDay = 1) {
        const text = conditionText.toLowerCase();

        if (text.includes('clear') || text.includes('sunny')) {
            return isDay ? 'wi wi-day-sunny' : 'wi wi-night-clear';
        }
        if (text.includes('partly cloudy')) {
            return isDay ? 'wi wi-day-cloudy' : 'wi wi-night-alt-cloudy';
        }
        if (text.includes('cloudy') || text.includes('overcast')) {
            return 'wi wi-cloudy';
        }
        if (text.includes('mist') || text.includes('fog') || text.includes('haze')) {
            return 'wi wi-fog';
        }
        if (text.includes('patchy rain') || text.includes('light rain') || text.includes('drizzle')) {
            return 'wi wi-sprinkle';
        }
        if (text.includes('rain')) {
            return 'wi wi-rain';
        }
        if (text.includes('thunderstorm') || text.includes('storm')) {
            return 'wi wi-thunderstorm';
        }
        if (text.includes('snow') || text.includes('sleet') || text.includes('ice pellets')) {
            return 'wi wi-snow';
        }
        if (text.includes('wind')) {
            return 'wi wi-strong-wind';
        }
        
        return isDay ? 'wi wi-day-sunny' : 'wi wi-night-clear';
    }

    showLoading() {
        this.loadingEl.classList.add('show');
    }

    hideLoading() {
        this.loadingEl.classList.remove('show');
    }

    showError(message) {
        this.errorEl.querySelector('p').textContent = message;
        this.errorEl.classList.add('show');
    }

    hideError() {
        this.errorEl.classList.remove('show');
    }
}

// Initialize the weather app
document.addEventListener('DOMContentLoaded', () => {
    new WeatherApp();
});
