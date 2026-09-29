/**
 * Large Australian employers and brands, suggested as someone types a company name - alongside the
 * companies already in their own profile, which come first. Suggestions only.
 */
export const COMPANY_CATALOG: readonly string[] = [
  // Retail & consumer
  "Woolworths Group", "Coles Group", "Wesfarmers", "Bunnings", "Kmart Australia", "Target Australia",
  "Officeworks", "Aldi Australia", "IGA", "Metcash", "JB Hi-Fi", "The Good Guys", "Harvey Norman",
  "Myer", "David Jones", "Big W", "Chemist Warehouse", "Priceline Pharmacy", "Endeavour Group",
  "Dan Murphy's", "BWS", "Super Retail Group", "Rebel Sport", "Supercheap Auto", "BCF", "Cotton On Group",
  "Country Road Group", "Lululemon", "Adairs", "Lovisa", "Premier Investments", "Sportsgirl", "Mecca",
  "Sephora Australia", "IKEA Australia", "Costco Australia", "7-Eleven Australia", "Amazon Australia",
  "The Iconic", "Catch.com.au", "Kogan.com", "Petbarn", "Spotlight Group", "Nike", "Apple",
  // Banking, finance & insurance
  "Commonwealth Bank", "Westpac", "ANZ", "NAB", "Macquarie Group", "Bendigo and Adelaide Bank",
  "Bank of Queensland", "Suncorp", "ING Australia", "AMP", "Insurance Australia Group (IAG)", "QBE",
  "Allianz Australia", "NRMA Insurance", "RACV", "RAC WA", "Medibank", "Bupa", "HCF", "nib",
  "Australian Unity", "AustralianSuper", "Aware Super", "UniSuper", "Rest Super", "HESTA", "Hostplus",
  "Colonial First State", "Magellan", "Challenger", "Zip Co", "Afterpay", "Judo Bank", "Latitude Financial",
  "Computershare", "ASX", "Tyro", "Stripe", "Block",
  // Professional services & recruitment
  "Deloitte", "PwC", "EY", "KPMG", "Accenture", "BDO", "Grant Thornton", "RSM Australia",
  "Pitcher Partners", "McKinsey & Company", "Boston Consulting Group", "Bain & Company", "Capgemini",
  "IBM", "Infosys", "Tata Consultancy Services", "Wipro", "Cognizant", "DXC Technology", "NTT Data",
  "Allens", "Herbert Smith Freehills", "King & Wood Mallesons", "MinterEllison", "Gilbert + Tobin",
  "Clayton Utz", "Ashurst", "Corrs Chambers Westgarth", "Maurice Blackburn", "Slater and Gordon",
  "Hays", "Randstad", "Adecco", "Michael Page", "Robert Walters", "Hudson", "Chandler Macleod",
  // Technology & media
  "Atlassian", "Canva", "Xero", "SafetyCulture", "Culture Amp", "Employment Hero", "Airwallex",
  "WiseTech Global", "Seek", "REA Group", "Domain", "Carsales", "Nine Entertainment", "News Corp Australia",
  "Seven West Media", "ABC", "SBS", "Foxtel", "Telstra", "Optus", "TPG Telecom", "Vodafone Australia",
  "NBN Co", "Aussie Broadband", "Google", "Microsoft", "Amazon Web Services (AWS)", "Meta", "Oracle",
  "Salesforce", "SAP", "Cisco", "Dell Technologies", "HP", "Canon Australia", "Samsung",
  "Data#3", "Datacom", "Nuix", "Megaport", "Envato", "Linktree", "Rokt", "Octopus Deploy", "Deputy",
  // Healthcare, aged care & disability
  "Ramsay Health Care", "Healthscope", "St Vincent's Health Australia", "Sonic Healthcare",
  "Healius", "Australian Clinical Labs", "CSL", "ResMed", "Cochlear", "Regis Aged Care", "Estia Health",
  "Opal HealthCare", "Uniting", "Anglicare", "Baptcare", "BaptistCare", "Catholic Healthcare",
  "Mercy Health", "Calvary", "Mater", "Epworth HealthCare", "Silver Chain", "Benetas",
  "Life Without Barriers", "HammondCare", "Royal Flying Doctor Service", "NSW Health", "Queensland Health",
  "Victorian Department of Health", "WA Health", "SA Health",
  // Government & public sector
  "Australian Public Service", "Services Australia", "Australian Taxation Office", "Department of Defence",
  "Department of Home Affairs", "Department of Health and Aged Care", "Department of Education",
  "Department of Social Services", "NDIA", "Australian Bureau of Statistics", "CSIRO",
  "Reserve Bank of Australia", "APRA", "ASIC", "ACCC", "Australia Post", "Transport for NSW",
  "Sydney Trains", "Metro Trains Melbourne", "Queensland Rail", "NSW Department of Education",
  "Victorian Department of Education", "City of Sydney", "City of Melbourne", "Brisbane City Council",
  "NSW Police Force", "Victoria Police", "Queensland Police Service", "Fire and Rescue NSW",
  "Ambulance Victoria",
  // Education
  "University of Sydney", "University of Melbourne", "UNSW Sydney", "Monash University",
  "University of Queensland", "Australian National University", "TAFE NSW", "TAFE Queensland",
  // Resources, energy, property & construction
  "BHP", "Rio Tinto", "Fortescue", "Woodside Energy", "Santos", "Origin Energy", "AGL", "EnergyAustralia",
  "Newmont", "Northern Star Resources", "South32", "Glencore", "Mineral Resources", "Pilbara Minerals",
  "Ampol", "Viva Energy", "Orica", "BlueScope", "Boral", "James Hardie", "Amcor", "Brambles",
  "Downer", "CIMIC Group", "Lendlease", "Multiplex", "Laing O'Rourke", "John Holland", "Acciona",
  "Stockland", "Mirvac", "Scentre Group", "GPT Group", "Dexus", "Goodman Group", "Aurecon", "Arup", "GHD",
  "WSP", "Jacobs", "AECOM", "Stantec", "Beca", "Worley", "Monadelphous", "Thiess", "Sydney Water",
  "Ausgrid", "Endeavour Energy", "Jemena", "Transurban",
  // Transport, logistics & travel
  "Qantas", "Virgin Australia", "Jetstar", "Rex Airlines", "Sydney Airport", "Melbourne Airport",
  "Toll Group", "StarTrack", "DHL", "FedEx", "Linfox", "Qube", "Aurizon", "Pacific National",
  "Uber", "DoorDash", "Menulog", "Flight Centre", "Webjet",
  // Food, hospitality & entertainment
  "McDonald's Australia", "KFC", "Hungry Jack's", "Domino's Pizza", "Guzman y Gomez", "Grill'd",
  "Nando's", "Subway", "Starbucks", "Boost Juice", "Retail Food Group", "Collins Foods", "Accor",
  "Marriott", "Hilton", "IHG", "Crown Resorts", "The Star Entertainment Group", "Merivale",
  "Australian Venue Co", "Event Hospitality & Entertainment", "Hoyts", "Village Roadshow", "Lion",
  "Carlton & United Breweries", "Coca-Cola Europacific Partners", "Asahi Beverages",
  "Treasury Wine Estates", "Arnott's", "Nestlé", "Mondelez", "Fonterra", "Saputo", "Inghams",
  "Bega Cheese", "Goodman Fielder", "Simplot", "Lactalis",
  // Not-for-profit
  "Australian Red Cross", "The Salvation Army", "St Vincent de Paul Society", "Mission Australia",
  "The Smith Family", "Save the Children", "World Vision Australia", "Oxfam Australia",
  "Beyond Blue", "Lifeline", "Guide Dogs Australia", "RSPCA", "YMCA", "Scouts Australia",
];
