"use client";
/**
 * reception.tsx — الاستقبال والطوابير (agent 2-c).
 * Dense operations console: today's board / search & register / live queue.
 */
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/i18n";
import { PrintStyle } from "./emr-shared";
import { ReceptionBoard } from "./reception-board";
import { ReceptionSearch } from "./reception-search";
import { ReceptionQueue } from "./reception-queue";

export default function Reception() {
  const { t } = useI18n();
  return (
    <div className="p-3 md:p-4 max-w-[1600px] mx-auto">
      <PrintStyle />
      <Tabs defaultValue="board" className="gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-lg font-bold whitespace-nowrap">{t("rec.title")}</h1>
          <TabsList className="h-9">
            <TabsTrigger value="board" className="text-xs px-3 h-7">{t("rec.tab.board")}</TabsTrigger>
            <TabsTrigger value="search" className="text-xs px-3 h-7">{t("rec.tab.search")}</TabsTrigger>
            <TabsTrigger value="queue" className="text-xs px-3 h-7">{t("rec.tab.queue")}</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="board" className="mt-0">
          <ReceptionBoard />
        </TabsContent>
        <TabsContent value="search" className="mt-0">
          <ReceptionSearch />
        </TabsContent>
        <TabsContent value="queue" className="mt-0">
          <ReceptionQueue />
        </TabsContent>
      </Tabs>
    </div>
  );
}
