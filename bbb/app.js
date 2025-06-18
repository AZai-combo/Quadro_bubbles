const { createApp } = Vue

const app = createApp({
    data() {
        return {
            title: 'Пузырьки',
            data: [],
            error: null,
            maxRows: 15,
            allData: [],
            isFileLoaded: false,
            stepWeight: 5, // Значение по умолчанию
            availableWeights: [1, 5, 10, 100], // Доступные значения веса
            hasNoteColumn: false
        }
    },
    mounted() {
        // Пытаемся автоматически загрузить файл при старте
        this.$nextTick(() => {
            // Добавляем небольшую задержку перед загрузкой
            setTimeout(() => {
                this.loadDefaultFile();
            }, 1000); // Задержка в 1 секунду
        });

        // Добавляем слушатель событий клавиатуры
        document.addEventListener('keydown', this.handleKeyPress);
    },
    unmounted() {
        // Удаляем слушатель при уничтожении компонента
        document.removeEventListener('keydown', this.handleKeyPress);
    },
    methods: {
        handleKeyPress(event) {
            // Проверяем, что есть загруженные данные
            if (!this.isFileLoaded) return;
            
            // Обрабатываем нажатие клавиш вверх и вправо для увеличения
            if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
                this.increaseMaxRows();
            }
            // Обрабатываем нажатие клавиш вниз и влево для уменьшения
            else if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
                this.decreaseMaxRows();
            }
        },
        async loadDefaultFile() {
            return new Promise((resolve, reject) => {
                console.log('Попытка загрузить файл data_boiled.xlsx...');
                const xhr = new XMLHttpRequest();
                xhr.open('GET', 'data_boiled.xlsx', true);
                xhr.responseType = 'arraybuffer';

                xhr.onload = async () => {
                    if (xhr.status === 200) {
                        console.log('Файл успешно загружен');
                        try {
                            await this.processExcelData(xhr.response);
                            resolve();
                        } catch (error) {
                            this.error = "Ошибка при обработке файла. Загрузите файл вручную.";
                            console.error('Ошибка при обработке файла:', error);
                            reject(error);
                        }
                    } else {
                        this.error = `Файл не найден (статус: ${xhr.status})`;
                        console.error(`Ошибка загрузки файла. Статус: ${xhr.status}`);
                        reject(new Error(`Файл не найден (статус: ${xhr.status})`));
                    }
                };

                xhr.onerror = (error) => {
                    this.error = "Ошибка при загрузке файла. Загрузите файл вручную.";
                    console.error('Ошибка при загрузке файла:', error);
                    reject(error);
                };

                xhr.send();
            });
        },

        async processExcelData(arrayBuffer) {
            try {
                const data = new Uint8Array(arrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                
                const jsonData = XLSX.utils.sheet_to_json(worksheet);
                
                if (!jsonData.length || !jsonData[0].hasOwnProperty('X') || 
                    !jsonData[0].hasOwnProperty('Y') || 
                    !jsonData[0].hasOwnProperty('R') ||
                    !jsonData[0].hasOwnProperty('Name')) {
                    throw new Error("Файл должен содержать колонки: X, Y, R, Name");
                }

                const validData = jsonData.filter(item => 
                    !isNaN(item.X) && !isNaN(item.Y) && !isNaN(item.R));
                
                if (validData.length !== jsonData.length) {
                    throw new Error("Колонки X, Y, R должны содержать только числа");
                }

                this.allData = validData;
                this.isFileLoaded = true;
                this.error = null;

                // Ждем следующего тика Vue перед обновлением данных и отрисовкой
                await this.$nextTick();
                this.updateDisplayedData();
            } catch (error) {
                this.error = "Ошибка при чтении файла: " + error.message;
                this.isFileLoaded = false;
            }
        },

        handleFileUpload(event) {
            const file = event.target.files[0];
            this.error = null;
            
            if (!file) {
                this.error = "Пожалуйста, выберите файл";
                return;
            }

            const reader = new FileReader();
            reader.onload = async (e) => {
                await this.processExcelData(e.target.result);
            };
            reader.onerror = (error) => {
                this.error = "Ошибка при чтении файла: " + error.message;
                this.isFileLoaded = false;
            };
            reader.readAsArrayBuffer(file);
        },

        updateDisplayedData() {
            if (!this.allData.length) return;
            
            this.data = this.allData.slice(0, this.maxRows);
            // Ждем следующего тика Vue перед созданием графика
            this.$nextTick(() => {
                this.createBubbleChart();
            });
        },

        setStepWeight(weight) {
            this.stepWeight = weight;
        },

        increaseMaxRows() {
            this.maxRows = Math.min(this.maxRows + this.stepWeight, this.allData.length);
            this.updateDisplayedData();
        },

        decreaseMaxRows() {
            this.maxRows = Math.max(this.stepWeight, this.maxRows - this.stepWeight);
            this.updateDisplayedData();
        },

        createBubbleChart() {
            // Очищаем предыдущий график
            const chartElement = document.getElementById("chart");
            if (!chartElement) return;

            d3.select("#chart").selectAll("*").remove();

            if (!this.data.length) return;

            // Настройка размеров
            const width = 600;
            const height = 400;
            const margin = { top: 20, right: 120, bottom: 30, left: 40 };

            // Создаем SVG контейнер
            const svg = d3.select("#chart")
                .append("svg")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom);

            // Создаем масштабирование для X
            const xScale = d3.scaleLinear()
                .domain([0, Math.ceil(d3.max(this.data, d => d.X) / 100) * 100])
                .range([margin.left, width - margin.right]);

            // Создаем масштабирование для Y
            const yScale = d3.scaleLinear()
                .domain([0, 10])
                .range([height - margin.bottom, margin.top]);

            // Создаем масштабирование для радиуса
            const radiusScale = d3.scaleLinear()
                .domain([0, d3.max(this.data, d => d.R)])
                .range([5, 30]);

            // Функция определения цвета в зависимости от X mod 4
            const getColor = x => {
                switch(Math.floor(x) % 4) {
                    case 0: return 'yellow';
                    case 1: return 'green';
                    case 2: return 'red';
                    case 3: return 'blue';
                    default: return 'steelblue';
                }
            };

            // Функция определения яркости цвета
            const getColorBrightness = color => {
                const colors = {
                    'yellow': 255,  // очень светлый
                    'green': 80,    // темный (изменено)
                    'red': 100,     // средне-темный
                    'blue': 80,     // темный
                    'steelblue': 110 // средне-темный
                };
                return colors[color] || 128;
            };

            // Функция определения цвета текста
            const getTextColor = backgroundColor => {
                const brightness = getColorBrightness(backgroundColor);
                return brightness > 128 ? 'black' : 'white';
            };

            // Добавляем круги
            const circles = svg.selectAll("circle")
                .data(this.data)
                .enter()
                .append("circle")
                .attr("cx", d => xScale(d.X))
                .attr("cy", d => yScale(d.Y))
                .attr("r", d => radiusScale(d.R))
                .style("fill", d => getColor(d.X))
                .style("opacity", 0.5);

            // Добавляем интерактивность
            circles
                .on("mouseover", function(event, d) {
                    const bubbleColor = getColor(d.X);
                    const radius = radiusScale(d.R);
                    const isSmallCircle = radius <= 7;
                    const textColor = isSmallCircle ? 'black' : getTextColor(bubbleColor);
                    
                    d3.select(this)
                        .style("opacity", 1)
                        .style("stroke", "black")
                        .style("stroke-width", 2);
                    
                    // Основной тултип со значением X
                    svg.append("text")
                        .attr("class", "tooltip value")
                        .attr("x", xScale(d.X) + (isSmallCircle ? radius + 3 : 0))
                        .attr("y", yScale(d.Y) + (isSmallCircle ? 0 : 3))
                        .attr("text-anchor", isSmallCircle ? "start" : "middle")
                        .style("fill", textColor)
                        .text(d.X);

                    // Дополнительный тултип с комментарием
                    if (d.Note) {
                        // Функция для разбиения текста на строки по maxWidth символов
                        const splitIntoLines = (text, maxWidth) => {
                            const words = text.split(' ');
                            const lines = [];
                            let currentLine = words[0];

                            for (let i = 1; i < words.length; i++) {
                                const word = words[i];
                                const width = currentLine.length + word.length + 1; // +1 для пробела

                                if (width <= maxWidth) {
                                    currentLine += ' ' + word;
                                } else {
                                    lines.push(currentLine);
                                    currentLine = word;
                                }
                            }
                            lines.push(currentLine);
                            return lines;
                        };

                        const lines = splitIntoLines(d.Note, 40);
                        const lineHeight = 14; // высота строки в пикселях

                        // Создаем текстовый элемент для каждой строки
                        lines.forEach((line, i) => {
                            svg.append("text")
                                .attr("class", "tooltip note")
                                .attr("x", xScale(d.X) + radius + 5)
                                .attr("y", yScale(d.Y) - radius - 5 + (i * lineHeight)) // Смещаем каждую следующую строку вниз
                                .attr("text-anchor", "start")
                                .style("fill", "black")
                                .style("font-size", "smaller")
                                .text(line);
                        });
                    }
                })
                .on("mouseout", function() {
                    d3.select(this)
                        .style("opacity", 0.5)
                        .style("stroke", "none");
                    
                    svg.selectAll(".tooltip").remove(); // Удаляем оба тултипа
                });

            // Добавляем оси
            const xAxis = d3.axisBottom(xScale)
                .tickValues(d3.range(0, xScale.domain()[1] + 100, 100));

            const yAxis = d3.axisLeft(yScale)
                .tickValues(d3.range(0, 11, 1));

            svg.append("g")
                .attr("transform", `translate(0,${height - margin.bottom})`)
                .call(xAxis);

            svg.append("g")
                .attr("transform", `translate(${margin.left},0)`)
                .call(yAxis);

            // Добавляем подписи к осям
            svg.append("text")
                .attr("x", width / 2)
                .attr("y", height + margin.top)
                .attr("text-anchor", "middle")
                .text("X");

            svg.append("text")
                .attr("transform", "rotate(-90)")
                .attr("x", -height / 2)
                .attr("y", margin.left - 30)
                .attr("text-anchor", "middle")
                .text("Y");

            // Добавляем информацию о количестве отображаемых точек
            svg.append("text")
                .attr("x", width)
                .attr("y", margin.top)
                .attr("text-anchor", "start")
                .text(`Показано ${this.data.length} из ${this.allData.length}`);
        }
    }
}).mount('#app')