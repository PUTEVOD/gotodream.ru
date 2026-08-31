import React from "react";
import { Link } from "react-router-dom";
import { SECTIONS, sectionLabel } from "../layout/sections";

/** Восемь разделов сервиса плитками. Список — в components/layout/sections.jsx. */
const SectionsGrid = () => (
    <section className="gtd-container gtd-section" aria-labelledby="sections-title">
        <h2 className="gtd-eyebrow" id="sections-title">Разделы</h2>

        <div className="gtd-tiles">
            {SECTIONS.map((section) => {
                const content = (
                    <>
                        <div className="gtd-tile__title">
                            {section.title.map((line, index) => (
                                <React.Fragment key={line}>
                                    {index > 0 && <br />}
                                    {line}
                                </React.Fragment>
                            ))}
                        </div>
                        <div className="gtd-tile__icon">{section.icon}</div>
                    </>
                );

                return section.path ? (
                    <Link
                        key={section.id}
                        to={section.path}
                        className="gtd-tile gtd-tile--link"
                        aria-label={sectionLabel(section)}
                    >
                        {content}
                    </Link>
                ) : (
                    <div key={section.id} className="gtd-tile gtd-tile--soon" title="Раздел в разработке">
                        {content}
                    </div>
                );
            })}
        </div>
    </section>
);

export default SectionsGrid;
