-- CreateTable
CREATE TABLE "Instrument" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT,
    "type" TEXT NOT NULL DEFAULT 'ETF',
    "exchangeCode" TEXT,
    "exchangeName" TEXT,
    "assetClass" TEXT,
    "listingCountryCode" TEXT,
    "inceptionDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Instrument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketData" (
    "id" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "asOfDate" DATE NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "volume" BIGINT,
    "nav" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Instrument_symbol_type_key" ON "Instrument"("symbol", "type");

-- CreateIndex
CREATE INDEX "Instrument_symbol_idx" ON "Instrument"("symbol");

-- CreateIndex
CREATE INDEX "Instrument_type_idx" ON "Instrument"("type");

-- CreateIndex
CREATE INDEX "Instrument_exchangeCode_idx" ON "Instrument"("exchangeCode");

-- CreateIndex
CREATE UNIQUE INDEX "MarketData_instrumentId_asOfDate_key" ON "MarketData"("instrumentId", "asOfDate");

-- CreateIndex
CREATE INDEX "MarketData_instrumentId_idx" ON "MarketData"("instrumentId");

-- CreateIndex
CREATE INDEX "MarketData_asOfDate_idx" ON "MarketData"("asOfDate");

-- CreateIndex
CREATE INDEX "MarketData_instrumentId_asOfDate_idx" ON "MarketData"("instrumentId", "asOfDate");

-- AddForeignKey
ALTER TABLE "MarketData" ADD CONSTRAINT "MarketData_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
