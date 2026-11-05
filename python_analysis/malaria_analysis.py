import pandas as pd
import matplotlib.pyplot as plt

data = pd.read_csv("../Datasets(CLEANED)/Export_Malaria_Cases_(Confirmed).csv")

print("WELCOME TO MALARIA WATCH DATA ANALYSIS")

print("\nFIRST FIVE RECORDS:")
print(data.head())

print("\nDATASET INFORMATION:")
print(data.info())

print("\nDATASET STATISTICS:")
print(data.describe())

print("\nDATASET SHAPE:")
print("Number of rows and columns:", data.shape)

print("\nAVAILABLE YEARS:")
print(sorted(data["Period"].unique()))

print("\nNUMBER OF RECORDS PER YEAR:")
print(data["Period"].value_counts().sort_index())

latest_year = data["Period"].max()

regional_data = data[
    (data["Period"] == latest_year) &
    (data["Location"] != "Uganda") &
    (data["Age Group"] == "0 - 59 Months")
]

regional_data = regional_data.sort_values(
    by="Value",
    ascending=False
)

print("\nREGIONAL RECORDS FOR CHILDREN UNDER FIVE")
print("Year:", latest_year)
print(regional_data[["Location", "Value"]])

plt.figure(figsize=(10, 6))

plt.bar(
    regional_data["Location"],
    regional_data["Value"]
)

plt.title( "Recorded Confirmed Malaria Cases Among Children Under Five")
plt.xlabel("Region")
plt.ylabel("Recorded Value")

plt.xticks(rotation=45)

plt.tight_layout()

plt.show()

print("\nDATA ANALYSIS COMPLETED!")

