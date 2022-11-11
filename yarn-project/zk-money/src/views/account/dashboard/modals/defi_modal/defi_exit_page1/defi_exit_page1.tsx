import { DefiSettlementTime } from '@aztec/sdk';
import type { StrOrMax } from '../../../../../../alt-model/forms/constants.js';
import {
  DefiFormFeedback,
  DefiFormFields,
  DefiFormValidationResult,
} from '../../../../../../alt-model/defi/defi_form/index.js';
import { DefiRecipe } from '../../../../../../alt-model/defi/types.js';
import { SplitSection } from '../../sections/split_section/index.js';
import { RecipeSettlementTimeInformationSection } from '../../sections/settlement_time_information_section/index.js';
import { DefiGasSection } from './../defi_gas_section.js';
import { DefiWebLinks } from './../defi_web_links/index.js';
import { ExpectedExitOutputSection } from './expected_exit_output_section/index.js';
import { FooterSection } from '../../sections/footer_section/index.js';
import { AmountSelection } from '../../../../../../components/index.js';
import style from './defi_exit_page1.module.css';

interface DefiExitPage1Props {
  recipe: DefiRecipe;
  fields: DefiFormFields;
  validationResult: DefiFormValidationResult;
  feedback: DefiFormFeedback;
  onChangeAmountStrOrMax: (value: StrOrMax) => void;
  onChangeSpeed: (value: DefiSettlementTime) => void;
  onNext: () => void;
}

export function DefiExitPage1({
  recipe,
  fields,
  validationResult,
  feedback,
  onChangeAmountStrOrMax,
  onChangeSpeed,
  onNext,
}: DefiExitPage1Props) {
  return (
    <div className={style.root}>
      <div className={style.top}>
        <div className={style.description}>{recipe.exitDesc}</div>
        <DefiWebLinks recipe={recipe} />
      </div>
      <SplitSection
        leftPanel={
          <AmountSelection
            maxAmount={validationResult.maxOutput ?? 0n}
            asset={validationResult.input.depositAsset}
            amountStringOrMax={fields.amountStrOrMax}
            onChangeAmountStringOrMax={onChangeAmountStrOrMax}
            message={feedback.amount}
            balanceType="L2"
          />
        }
        rightPanel={<ExpectedExitOutputSection recipe={recipe} validationResult={validationResult} />}
      />
      <SplitSection
        leftPanel={
          <DefiGasSection
            speed={fields.speed}
            onChangeSpeed={onChangeSpeed}
            recipe={recipe}
            bridgeCallData={validationResult.input.bridgeCallData}
            feeAmounts={validationResult?.feeAmounts}
          />
        }
        rightPanel={
          <RecipeSettlementTimeInformationSection
            bridgeCallData={validationResult.input.bridgeCallData}
            selectedSpeed={fields.speed}
          />
        }
      />
      <FooterSection onNext={onNext} nextDisabled={!validationResult.isValid} feedback={feedback.footer} />
    </div>
  );
}