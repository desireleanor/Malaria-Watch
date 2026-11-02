const datasets = [
    {
        name: "Malaria Admissions (Reported)",
        file: "data/Export_Malaria_Admissions_(Reported).csv"
    },
    {
        name: "Malaria Cases (Children Under 5 Years)",
        file: "data/Export_Malaria_Cases_(Children_&lt;5_Years).csv"
    },
    {
        name: "Malaria Cases (Confirmed)",
        file: "data/Export_Malaria_Cases_(Confirmed) csv.csv"
    },
    {
        name: "Malaria Cases (Estimated)",
        file: "data/Export_Malaria_Cases_(Estimated).csv"
    },
    {
        name: "Malaria Cases as Percentage of Total OPD",
        file: "data/Export_Malaria_Cases_as_Percentage_of_Total_OPD.csv"
    },
    {
        name: "Malaria Deaths (Estimated)",
        file: "data/Export_Malaria_Deaths_(Estimated).csv"
    },
    {
        name: "Malaria Deaths (Reported)",
        file: "data/Export_Malaria_Deaths_(Reported).csv"
    },
    {
        name: "Malaria in Pregnancy Prevalence",
        file: "data/Export_Malaria_in_Pregnancy_Prevalence.csv"
    },
    {
        name: "Malaria Incidence Rate - Dataset 1",
        file: "data/Export_Malaria_Incidence_Rate_(Per_1,000_Population) csv.csv"
    },
    {
        name: "Malaria Incidence Rate - Dataset 2",
        file: "data/Export_Malaria_Incidence_Rate_(Per_1,000_Population).csv"
    },
    {
        name: "Malaria Incidence Rate - Dataset 3",
        file: "data/Export_Malaria_Incidence_Rate_(Per_1,000_Population)1.csv"
    },
    {
        name: "Malaria OPD Attendances",
        file: "data/Export_Malaria_OPD_Attendances copy.csv"
    },
    {
        name: "Malaria Test Positivity Rate",
        file: "data/Export_Malaria_Test_Positivity_Rate copy.csv"
    }
];


// ========================================
// CSV PARSER
// ========================================

function parseCSV(text) {
    const rows = [];
    let row = [];
    let value = "";
    let insideQuotes = false;

    text = text.replace(/^\uFEFF/, "");

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (insideQuotes && nextChar === '"') {
                value += '"';
                i++;
            } else {
                insideQuotes = !insideQuotes;
            }
        } else if (char === "," && !insideQuotes) {
            row.push(value.trim());
            value = "";
        } else if (
            (char === "\n" || char === "\r") &&
            !insideQuotes
        ) {
            if (char === "\r" && nextChar === "\n") {
                i++;
            }

            row.push(value.trim());

            if (row.some(cell => cell !== "")) {
                rows.push(row);
            }

            row = [];
            value = "";
        } else {
            value += char;
        }
    }

    // Add the final row
    row.push(value.trim());

    if (row.some(cell => cell !== "")) {
        rows.push(row);
    }

    return rows;
}


// ========================================
// CREATE A TABLE FROM CSV DATA
// ========================================

function createTable(rows) {
    const table = document.createElement("table");
    table.className = "table table-striped table-bordered table-hover";

    // Create the table header
    const thead = document.createElement("thead");
    thead.className = "table-success";

    const headerRow = document.createElement("tr");

    rows[0].forEach(heading => {
        const th = document.createElement("th");
        th.textContent = heading;
        headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create the table body
    const tbody = document.createElement("tbody");

    rows.slice(1).forEach(row => {
        const tr = document.createElement("tr");

        rows[0].forEach((heading, index) => {
            const td = document.createElement("td");
            td.textContent = row[index] ?? "";
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });

    table.appendChild(tbody);

    return table;
}


// ========================================
// LOAD AND DISPLAY EACH DATASET
// ========================================

async function loadDataset(dataset, datasetsContainer) {
    // Create the dataset card
    const card = document.createElement("div");
    card.className = "card mb-4 shadow-sm";

    // Create the card header
    const header = document.createElement("div");
    header.className =
        "card-header bg-success text-white d-flex justify-content-between align-items-center";

    // Create the title
    const title = document.createElement("h5");
    title.className = "mb-0";
    title.textContent = dataset.name;

    // Create the button
    const button = document.createElement("button");
    button.className = "btn btn-light btn-sm toggle-data";
    button.textContent = "View Data";
    button.type = "button";

    header.appendChild(title);
    header.appendChild(button);

    // Create the content area, hidden initially
    const content = document.createElement("div");
    content.className = "card-body dataset-content";
    content.style.display = "none";

    // Add the header and content to the card
    card.appendChild(header);
    card.appendChild(content);

    // Add the card to the webpage
    datasetsContainer.appendChild(card);

    // Button toggles only this dataset's content
    button.addEventListener("click", function () {
        const isHidden = content.style.display === "none";

        content.style.display = isHidden ? "block" : "none";
        button.textContent = isHidden ? "Hide Data" : "View Data";
        button.setAttribute("aria-expanded", String(isHidden));
    });

    // Show a loading message
    content.textContent = "Loading dataset...";

    try {
        const response = await fetch(dataset.file);

        if (!response.ok) {
            throw new Error(
                `HTTP ${response.status}: Could not find the file`
            );
        }

        const csvText = await response.text();

        // Detect common binary Office-file content
        if (
            csvText.startsWith("PK") &&
            csvText.includes("[Content_Types].xml")
        ) {
            throw new Error(
                "This file is not a plain-text CSV. Please convert it to CSV format."
            );
        }

        const rows = parseCSV(csvText);

        if (rows.length === 0) {
            throw new Error("The dataset is empty.");
        }

        // Display the number of records
        const recordCount = document.createElement("p");
        recordCount.className = "text-muted";
        recordCount.textContent =
            `Successfully loaded ${rows.length - 1} records.`;

        // Create a scrollable table
        const tableWrapper = document.createElement("div");
        tableWrapper.className = "table-responsive";

        const table = createTable(rows);
        tableWrapper.appendChild(table);

        // Replace loading message with the data
        content.replaceChildren(recordCount, tableWrapper);

        console.log(
            `${dataset.name}: loaded ${rows.length - 1} records`
        );

    } catch (error) {
        // Show the error inside the affected dataset card
        content.replaceChildren();

        const errorMessage = document.createElement("p");
        errorMessage.className = "text-danger mb-0";
        errorMessage.textContent =
            `Unable to load this dataset: ${error.message}`;

        content.appendChild(errorMessage);

        console.error(
            `Error loading ${dataset.name}:`,
            error
        );
    }
}


// ========================================
// START THE DASHBOARD
// ========================================

document.addEventListener("DOMContentLoaded", function () {
    const datasetsContainer =
        document.getElementById("datasetsContainer");

    if (!datasetsContainer) {
        console.error(
            'The HTML element with id="datasetsContainer" was not found.'
        );
        return;
    }

    datasets.forEach(dataset => {
        loadDataset(dataset, datasetsContainer);
    });
});
