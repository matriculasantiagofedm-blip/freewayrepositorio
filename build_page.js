const fs = require('fs');

const backup = fs.readFileSync('page_backup.txt', 'utf8');
const lines = backup.split('\n');

let upperPart = [];
for (let i = 0; i < 951; i++) {
  upperPart.push(lines[i]);
}

// Add imports
upperPart.splice(20, 0, 
  "import { StepPersonalInfo } from '@/components/enroll/step-personal-info';",
  "import { StepCourseSelection } from '@/components/enroll/step-course-selection';",
  "import { StepScheduleBooking } from '@/components/enroll/step-schedule-booking';",
  "import { StepPayment } from '@/components/enroll/step-payment';",
  "import { OrderSummarySidebar } from '@/components/enroll/order-summary-sidebar';",
  "import { AnimatePresence } from 'framer-motion';"
);

const newReturn = `
  const handleNextStep = async () => {
    let isValid = false;
    if (step === 1) {
      isValid = await form.trigger(['clientName', 'studentIdNumber', 'clientEmail', 'studentPhone1', 'studentAddress']);
    } else if (step === 2) {
      isValid = await form.trigger(['vehicleTransmission', 'coursePlan']);
      if (!currentValues.coursePlan) {
        toast({ title: "Atención", description: "Debes seleccionar un plan.", variant: "destructive" });
        isValid = false;
      }
    } else if (step === 3) {
      isValid = await form.trigger(['theoreticalClassSchedule', 'practicalClassSchedules']);
      if (!currentValues.theoreticalClassSchedule) {
        toast({ title: "Atención", description: "Selecciona el horario teórico.", variant: "destructive" });
        isValid = false;
      } else if (practicalDays.length > 0 && currentValues.practicalClassSchedules?.length !== practicalDays.length) {
        toast({ title: "Atención", description: "Asigna horarios a todas tus clases prácticas.", variant: "destructive" });
        isValid = false;
      }
    }

    if (isValid) setStep(s => (s + 1) as any);
  };

  const handlePrevStep = () => {
    setStep(s => (s - 1) as any);
  };

  const currentPlanObj = currentPricingPlans.find(p => p.name === currentValues.coursePlan);
  const total = currentPlanObj ? currentPlanObj.price : 0;

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-blue-200">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="flex flex-col lg:flex-row w-full max-w-[1400px] mx-auto min-h-screen relative">
          
          {/* Main Content Area */}
          <div className="w-full lg:w-[65%] p-6 lg:p-12 xl:p-16 flex flex-col min-h-screen">
            
            {/* Header / Logo */}
            <div className="mb-12 flex items-center gap-3">
              <div className="bg-blue-600 text-white p-2 rounded-xl shadow-lg">
                <Car className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900 leading-none">ContractTime</h1>
                <p className="text-xs font-semibold text-blue-600 tracking-wider uppercase mt-1">Matrícula Online</p>
              </div>
            </div>

            {/* Stepper indicator */}
            <div className="flex items-center gap-2 mb-8">
              {[1, 2, 3, 4].map(num => (
                <div key={num} className="flex items-center gap-2">
                  <div className={\`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors \${step === num ? 'bg-blue-600 text-white shadow-md' : step > num ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}\`}>
                    {step > num ? <CheckCircle2 className="w-4 h-4" /> : num}
                  </div>
                  {num < 4 && <div className={\`h-1 w-8 sm:w-16 rounded-full \${step > num ? 'bg-emerald-500' : 'bg-slate-200'}\`}></div>}
                </div>
              ))}
            </div>

            {/* Step Content */}
            <div className="flex-1">
              <AnimatePresence mode="wait">
                {step === 1 && <StepPersonalInfo key="step1" />}
                {step === 2 && <StepCourseSelection key="step2" plans={currentPricingPlans} />}
                {step === 3 && (
                  <StepScheduleBooking 
                    key="step3" 
                    filteredTheoreticalSchedules={filteredTheoreticalSchedules}
                    currentValues={currentValues}
                    practicalDays={practicalDays}
                    timeSlots={TIME_SLOTS}
                    getSlotOccupancy={(d, s) => getSlotOccupancy(d, s, availability.globalCounts, availability.blockedSlots, availability.slotCapacities, availability.transmissionCounts, availability.activeVehiclesByTransmission, currentValues.vehicleTransmission)}
                    handleAssignAll={handleAssignAll}
                    getAssignedSlotForDate={getAssignedSlotForDate}
                    handleSlotSelection={handleSlotSelection}
                  />
                )}
                {step === 4 && (
                  <StepPayment 
                    key="step4"
                    total={total}
                    onApprovePayPal={onApprovePayPal}
                    handleFileChange={handleFileChange}
                    voucherBase64={voucherBase64}
                    setVoucherBase64={setVoucherBase64}
                    setVoucherMime={setVoucherMime}
                    isSubmitting={isSubmitting}
                    submitForm={form.handleSubmit(onSubmit, onInvalid)}
                  />
                )}
              </AnimatePresence>
            </div>

            {/* Navigation Buttons */}
            <div className="mt-12 pt-6 border-t border-slate-200 flex items-center justify-between">
              {step > 1 ? (
                <Button type="button" variant="outline" onClick={handlePrevStep} className="h-12 px-6 rounded-xl font-bold">
                  Atrás
                </Button>
              ) : <div></div>}
              
              {step < 4 ? (
                <Button type="button" onClick={handleNextStep} className="h-12 px-8 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 shadow-md">
                  Siguiente <ChevronRight className="w-5 h-5 ml-1" />
                </Button>
              ) : null}
            </div>
            
            {/* Footer */}
            <div className="mt-16 text-center pb-8">
              <p className="text-xs font-medium text-slate-400">© 2026 Freeway Escuela de Manejo.</p>
              <p className="text-[10px] text-slate-300 mt-1 flex items-center justify-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Transacciones encriptadas de extremo a extremo
              </p>
            </div>
          </div>

          {/* Sidebar Area */}
          <div className="w-full lg:w-[35%] bg-slate-900 lg:min-h-screen p-6 lg:p-12 relative overflow-hidden">
            <div className="lg:sticky lg:top-12">
              <OrderSummarySidebar 
                total={total}
                plans={currentPricingPlans}
                filteredTheoreticalSchedules={filteredTheoreticalSchedules}
              />
            </div>
          </div>

        </form>
      </Form>
    </div>
  );
}
`;

fs.writeFileSync('src/app/enroll/page.tsx', upperPart.join('\n') + '\n' + newReturn);
